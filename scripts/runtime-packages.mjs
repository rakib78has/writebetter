/**
 * Lists the packages bundled into the extension: the `dependencies` in
 * package.json and everything they depend on, found the way Node resolves
 * them. Dev dependencies are tools and test helpers and are never shipped.
 *
 * Shared by generate-notices.mjs (licence texts) and generate-sbom.mjs
 * (software bill of materials), so the two always describe the same set.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '..');

export function readPackage(directory) {
  return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
}

function locate(name, fromDirectory) {
  for (let dir = fromDirectory; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dirname(dir) === dir) throw new Error(`Cannot find package ${name}`);
  }
}

/** @returns {{ directory: string, pkg: Record<string, any> }[]} sorted by name */
export function runtimePackages() {
  const seen = new Map();
  const queue = Object.keys(readPackage(root).dependencies ?? {}).map((name) => [name, root]);
  while (queue.length > 0) {
    const [name, from] = queue.shift();
    const directory = locate(name, from);
    if (seen.has(directory)) continue;
    const pkg = readPackage(directory);
    seen.set(directory, pkg);
    for (const dependency of Object.keys(pkg.dependencies ?? {}))
      queue.push([dependency, directory]);
  }
  return [...seen.entries()]
    .map(([directory, pkg]) => ({ directory, pkg }))
    .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
}
