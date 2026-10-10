#!/usr/bin/env node
/**
 * Opens the packaged zip and checks what is really inside it: the file that
 * reaches users, rather than the dist/ folder it was made from.
 *
 * Usage: node scripts/verify-package.mjs [path-to-zip]
 * Defaults to writebetter-<version>.zip in the project root.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const zipPath = resolve(process.argv[2] ?? join(root, `writebetter-${version}.zip`));

if (!existsSync(zipPath)) {
  console.error(`✖ ${zipPath} does not exist. Run \`npm run package\` first.`);
  process.exit(1);
}

// --- Read the zip's central directory --------------------------------------
// Enough of the format to list entries and read stored or deflated files.

const zip = readFileSync(zipPath);
const endOffset = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (endOffset < 0) {
  console.error('✖ Not a zip file: end-of-directory record missing.');
  process.exit(1);
}
const entryCount = zip.readUInt16LE(endOffset + 10);
let cursor = zip.readUInt32LE(endOffset + 16);
const entries = new Map();
for (let i = 0; i < entryCount; i++) {
  if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Corrupt central directory');
  const method = zip.readUInt16LE(cursor + 10);
  const compressedSize = zip.readUInt32LE(cursor + 20);
  const nameLength = zip.readUInt16LE(cursor + 28);
  const extraLength = zip.readUInt16LE(cursor + 30);
  const commentLength = zip.readUInt16LE(cursor + 32);
  const localOffset = zip.readUInt32LE(cursor + 42);
  const name = zip.toString('utf8', cursor + 46, cursor + 46 + nameLength);
  entries.set(name, { method, compressedSize, localOffset });
  cursor += 46 + nameLength + extraLength + commentLength;
}

function readEntry(name) {
  const entry = entries.get(name);
  const nameLength = zip.readUInt16LE(entry.localOffset + 26);
  const extraLength = zip.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const data = zip.subarray(start, start + entry.compressedSize);
  return entry.method === 8 ? inflateRawSync(data) : data;
}

// --- Checks -----------------------------------------------------------------

const errors = [];
const fail = (message) => errors.push(message);
const names = [...entries.keys()];

if (!entries.has('manifest.json')) {
  fail('manifest.json is not at the root of the zip');
} else {
  const manifest = JSON.parse(readEntry('manifest.json').toString('utf8'));
  if (manifest.version !== version) {
    fail(`Packaged manifest is version ${manifest.version}, package.json is ${version}`);
  }
}

for (const name of names) {
  if (name.endsWith('.map')) fail(`Source map shipped: ${name}`);
  if (/\.(tsx?|mjs)$/.test(name)) fail(`Source file shipped: ${name}`);
  if (name.startsWith('/') || name.includes('..') || name.includes('\\')) {
    fail(`Unsafe path in zip: ${name}`);
  }
}

// The zip must hold exactly the built files, minus source maps.
const listFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
if (existsSync(dist)) {
  const expected = listFiles(dist)
    .map((file) => relative(dist, file).split(sep).join('/'))
    .filter((name) => !name.endsWith('.map'));
  for (const name of expected) if (!entries.has(name)) fail(`Missing from zip: ${name}`);
  for (const name of names) if (!expected.includes(name)) fail(`Not in dist/: ${name}`);
}

const MAX_ZIP_BYTES = 12 * 1024 * 1024;
const { size } = statSync(zipPath);
if (size > MAX_ZIP_BYTES) fail(`Zip is ${(size / 1048576).toFixed(1)} MB, over the 12 MB budget`);

if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`);
  console.error(`\nPackage verification failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(
  `✔ Package valid: ${relative(root, zipPath)}, ${names.length} files, ${(size / 1048576).toFixed(1)} MB`
);
