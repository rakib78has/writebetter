#!/usr/bin/env node
/**
 * Prints the CHANGELOG.md section for a version, for use as release notes.
 *
 * Usage: node scripts/release-notes.mjs [version]   (defaults to package.json)
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const version =
  process.argv[2] ?? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');

const heading = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\].*$`, 'm');
const match = heading.exec(changelog);
if (!match) {
  console.error(`✖ No CHANGELOG.md section for ${version}`);
  process.exit(1);
}
const rest = changelog.slice(match.index + match[0].length);
const next = rest.search(/^## /m);
const notes = (next < 0 ? rest : rest.slice(0, next)).trim();
if (notes === '') {
  console.error(`✖ The CHANGELOG.md section for ${version} is empty`);
  process.exit(1);
}
console.log(notes);
