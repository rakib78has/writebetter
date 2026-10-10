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
const ALLOWED_PERMISSIONS = new Set([]);

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

function requireFile(relativePath, reason, { allowEmpty = false } = {}) {
  const full = join(dist, relativePath);
  if (!existsSync(full)) return fail(`Missing ${relativePath} (${reason})`);
  if (!allowEmpty && statSync(full).size === 0) fail(`${relativePath} is empty (${reason})`);
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

const csp = manifest.content_security_policy?.extension_pages ?? '';
if (!csp.includes("script-src 'self'") || /unsafe-eval|unsafe-inline|https?:/.test(csp)) {
  fail(`extension_pages CSP must allow only bundled scripts. Found: "${csp}"`);
}

// --- Referenced files -------------------------------------------------------

// The worker has no event handlers until Milestone 2, so it builds to an empty
// file, which Chrome loads without complaint. Drop `allowEmpty` once it does
// real work, so a broken worker build is caught here again.
requireFile(manifest.background?.service_worker, 'background.service_worker', {
  allowEmpty: true,
});
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

// --- Report -----------------------------------------------------------------

if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`);
  console.error(`\nBuild validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`✔ Build valid: ${manifest.name} v${manifest.version}, ${files.length} files`);
console.log(`  Permissions: ${(manifest.permissions ?? []).join(', ') || 'none'}`);
console.log(`  Host permissions: none`);
