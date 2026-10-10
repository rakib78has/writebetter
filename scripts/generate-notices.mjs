#!/usr/bin/env node
/**
 * Writes dist/THIRD_PARTY_NOTICES.txt: the licence of every package bundled
 * into the extension.
 *
 * Harper is Apache-2.0 and React and fflate are MIT. Both licences require
 * their text to accompany any copy of the code, and the extension package is
 * a copy. Generating the file from node_modules at build time means it can't
 * drift from what is actually bundled.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i;

function readPackage(directory) {
  return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
}

/** Finds a dependency the way Node does: in node_modules, walking upwards. */
function locate(name, fromDirectory) {
  for (let dir = fromDirectory; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dirname(dir) === dir) throw new Error(`Cannot find package ${name}`);
  }
}

// Runtime dependencies only, followed transitively. Dev tools are not shipped.
const seen = new Map();
const queue = Object.keys(readPackage(root).dependencies ?? {}).map((name) => [name, root]);
while (queue.length > 0) {
  const [name, from] = queue.shift();
  const directory = locate(name, from);
  if (seen.has(directory)) continue;
  const pkg = readPackage(directory);
  seen.set(directory, pkg);
  for (const dependency of Object.keys(pkg.dependencies ?? {})) queue.push([dependency, directory]);
}

const sections = [...seen.entries()]
  .sort(([, a], [, b]) => a.name.localeCompare(b.name))
  .map(([directory, pkg]) => {
    const files = readdirSync(directory).filter((file) => LICENCE_FILE.test(file));
    if (files.length === 0) throw new Error(`${pkg.name} has no licence file to include`);
    const texts = files.map((file) => readFileSync(join(directory, file), 'utf8').trim());
    return [`${pkg.name} ${pkg.version} (${pkg.license})`, '-'.repeat(72), ...texts].join('\n\n');
  });

const header =
  'WriteBetter includes the following third-party software.\n' +
  'Each is listed with its version and full licence text.';
writeFileSync(
  join(root, 'dist', 'THIRD_PARTY_NOTICES.txt'),
  [header, ...sections].join(`\n\n${'='.repeat(72)}\n\n`) + '\n'
);
console.log(
  `✔ Wrote licences for ${sections.length} packages: ${[...seen.values()].map((p) => p.name).join(', ')}`
);
