#!/usr/bin/env node
/**
 * Validates dist/ before it can be packaged or released.
 *
 * A successful `vite build` only proves the code compiled. It does not prove
 * the manifest is loadable, that every file it names exists, that the
 * permission set has not quietly grown, or that no secret slipped into the
 * bundle. Those failures reach users, so they get their own gate.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');

/** Permissions the extension may request. Adding one requires editing this
 *  list *and* justifying it in docs/security.md. */
const ALLOWED_PERMISSIONS = new Set(['activeTab', 'contextMenus', 'scripting', 'storage']);

/** Patterns that look like credentials. The extension must never ship any. */
const SECRET_PATTERNS = [
  { name: 'OpenAI-style key', pattern: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: 'Anthropic key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const errors = [];
const fail = (message) => errors.push(message);

function requireFile(relativePath, reason) {
  const full = join(dist, relativePath);
  if (!existsSync(full)) return fail(`Missing ${relativePath} (${reason})`);
  if (statSync(full).size === 0) fail(`${relativePath} is empty (${reason})`);
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

if (!existsSync(dist)) {
  console.error('✖ dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}

// --- Manifest ---------------------------------------------------------------

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
} catch (error) {
  console.error(`✖ dist/manifest.json is missing or not valid JSON: ${error.message}`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

if (manifest.manifest_version !== 3) fail(`manifest_version must be 3`);
if (manifest.version !== version) {
  fail(`manifest version ${manifest.version} does not match package.json ${version}`);
}
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version ?? '')) {
  fail(`version "${manifest.version}" is not a valid Chrome extension version`);
}
if (!manifest.name || manifest.name.length > 75) fail('name must be 1–75 characters');
if (!manifest.description || manifest.description.length > 132) {
  fail('description must be 1–132 characters (Chrome Web Store limit)');
}

// --- Permissions ------------------------------------------------------------

for (const permission of manifest.permissions ?? []) {
  if (!ALLOWED_PERMISSIONS.has(permission)) {
    fail(`Permission "${permission}" is not approved. See docs/security.md.`);
  }
}
for (const key of ['host_permissions', 'optional_host_permissions']) {
  if (manifest[key]?.length) fail(`${key} must be empty. Found: ${manifest[key].join(', ')}`);
}

// The only relaxation allowed is 'wasm-unsafe-eval', which permits compiling
// WebAssembly (the grammar engine) but not JavaScript eval(). The quotes in
// the pattern matter: 'unsafe-eval' must not match 'wasm-unsafe-eval'.
const csp = manifest.content_security_policy?.extension_pages ?? '';
if (!csp.includes("script-src 'self'") || /'unsafe-eval'|unsafe-inline|https?:/.test(csp)) {
  fail(`extension_pages CSP must allow only bundled scripts. Found: "${csp}"`);
}

// --- Referenced files -------------------------------------------------------

requireFile(manifest.background?.service_worker, 'background.service_worker');
requireFile(manifest.action?.default_popup, 'action.default_popup');
for (const [size, path] of Object.entries(manifest.icons ?? {})) requireFile(path, `icons.${size}`);
for (const [size, path] of Object.entries(manifest.action?.default_icon ?? {})) {
  requireFile(path, `action.default_icon.${size}`);
}

// --- Bundle contents --------------------------------------------------------

const files = listFiles(dist);

for (const file of files.filter((f) => /\.(js|html|css|json)$/.test(f))) {
  const source = readFileSync(file, 'utf8');
  const name = relative(dist, file);

  for (const { name: kind, pattern } of SECRET_PATTERNS) {
    if (pattern.test(source)) fail(`${name} contains a string that looks like a secret (${kind})`);
  }

  // Chrome Web Store policy forbids executing code that is not in the package.
  if (/<script[^>]+src=["']https?:/i.test(source)) fail(`${name} loads a remote script`);
  if (/\bimport\(\s*["']https?:/.test(source)) fail(`${name} imports a remote module`);
}

// --- Network surface --------------------------------------------------------

// WriteBetter must not talk to any server. The end-to-end suite checks this
// at runtime (WB-SEC-018); this checks the shipped code itself, so a new
// dependency that phones home fails the build before any test runs.

/** URLs allowed in shipped code. None of them is ever requested. */
const ALLOWED_URLS = [
  /^http:\/\/www\.w3\.org\//, // XML namespace identifiers used by React DOM
  /^https:\/\/react\.dev\/errors\//, // React builds error *messages* with this
  /^https:\/\/tailwindcss\.com$/, // credit comment in the stylesheet
];
const URL_PATTERN = /\b(?:https?|wss?):\/\/[^\s"'`)<>]+/g;
/** Network APIs and the only bundles allowed to use them. */
const NETWORK_APIS = [
  // The grammar worker fetches its own WebAssembly file from the package.
  { name: 'fetch(', allowedIn: /^assets[\\/]grammar\.worker-[\w-]+\.js$/ },
  { name: 'XMLHttpRequest', allowedIn: null },
  { name: 'WebSocket', allowedIn: null },
  { name: 'EventSource', allowedIn: null },
  { name: 'sendBeacon', allowedIn: null },
];

for (const file of files.filter((f) => /\.(js|html|css)$/.test(f))) {
  const source = readFileSync(file, 'utf8');
  const name = relative(dist, file);
  for (const [url] of source.matchAll(URL_PATTERN)) {
    if (!ALLOWED_URLS.some((allowed) => allowed.test(url))) {
      fail(`${name} contains a URL that is not on the allow-list: ${url}`);
    }
  }
  for (const api of NETWORK_APIS) {
    if (source.includes(api.name) && !api.allowedIn?.test(name)) {
      fail(`${name} uses ${api.name.replace('(', '')}, which is not allowed there`);
    }
  }
}

// --- Size -------------------------------------------------------------------

// The grammar engine is one ~16 MB WebAssembly file. A second one means a
// different build of the engine was bundled by accident, doubling the size.
const wasmFiles = files.filter((file) => file.endsWith('.wasm'));
if (wasmFiles.length !== 1) {
  fail(
    `Expected exactly one .wasm file, found ${wasmFiles.length}: ${wasmFiles.map((f) => relative(dist, f)).join(', ')}`
  );
}

const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
const shippedBytes = files
  .filter((file) => !file.endsWith('.map'))
  .reduce((total, file) => total + statSync(file).size, 0);
if (shippedBytes > MAX_PACKAGE_BYTES) {
  fail(`Shipped files total ${(shippedBytes / 1048576).toFixed(1)} MB, over the 20 MB budget`);
}

// Apache-2.0 and MIT both require the licence text to travel with the code.
requireFile('THIRD_PARTY_NOTICES.txt', 'licences of bundled dependencies');

// --- Report -----------------------------------------------------------------

if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`);
  console.error(`\nBuild validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `✔ Build valid: ${manifest.name} v${manifest.version}, ${files.length} files, ` +
    `${(shippedBytes / 1048576).toFixed(1)} MB shipped`
);
console.log(`  Permissions: ${(manifest.permissions ?? []).join(', ') || 'none'}`);
console.log(`  Host permissions: none`);
