#!/usr/bin/env node
/**
 * Checks that every place a version is recorded agrees, before a release.
 *
 * Usage: node scripts/check-version.mjs [tag]
 * The tag defaults to GITHUB_REF_NAME when it looks like a version tag.
 *
 * The manifest takes its version from package.json at build time, so it
 * can't drift; validate-build.mjs checks that independently.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const { version } = JSON.parse(read('package.json'));
const lock = JSON.parse(read('package-lock.json'));
const changelog = read('CHANGELOG.md');
const refName = process.env.GITHUB_REF_NAME ?? '';
const tag = process.argv[2] ?? (/^v\d/.test(refName) ? refName : undefined);

const errors = [];
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  errors.push(`package.json version "${version}" is not MAJOR.MINOR.PATCH`);
}
if (lock.version !== version || lock.packages?.['']?.version !== version) {
  errors.push(`package-lock.json version does not match ${version}; run npm install`);
}
if (
  !new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm').test(
    changelog
  )
) {
  errors.push(`CHANGELOG.md has no "## [${version}] - YYYY-MM-DD" section`);
}
if (tag !== undefined && tag !== `v${version}`) {
  errors.push(`Tag ${tag} does not match package.json version ${version} (expected v${version})`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`);
  process.exit(1);
}
console.log(`✔ Version ${version} is consistent${tag ? ` with tag ${tag}` : ''}`);
