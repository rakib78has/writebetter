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

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, runtimePackages } from './runtime-packages.mjs';

const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i;

const packages = runtimePackages();
const sections = packages.map(({ directory, pkg }) => {
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
  `✔ Wrote licences for ${sections.length} packages: ${packages.map(({ pkg }) => pkg.name).join(', ')}`
);
