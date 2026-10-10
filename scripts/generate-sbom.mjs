#!/usr/bin/env node
/**
 * Writes writebetter-sbom.cdx.json: a CycloneDX 1.5 software bill of
 * materials listing every third-party package bundled into the extension,
 * with exact versions and licences. Published with each release so anyone
 * can check the extension against vulnerability databases.
 *
 * Written here rather than with `npm sbom`, which (npm 11.19) left React out
 * of a production SBOM. The package list comes from the same walk as the
 * licence notices, so the two always agree.
 *
 * Deliberately has no timestamp or random serial number, so the same
 * sources always produce the same file.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPackage, root, runtimePackages } from './runtime-packages.mjs';

const purl = (name, version) => `pkg:npm/${name.replace(/^@/, '%40')}@${version}`;
const self = readPackage(root);

const components = runtimePackages().map(({ pkg }) => ({
  type: 'library',
  'bom-ref': purl(pkg.name, pkg.version),
  name: pkg.name,
  version: pkg.version,
  purl: purl(pkg.name, pkg.version),
  licenses: [{ expression: pkg.license }],
}));

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    component: {
      type: 'application',
      'bom-ref': purl(self.name, self.version),
      name: self.name,
      version: self.version,
    },
  },
  components,
};

const output = join(root, 'writebetter-sbom.cdx.json');
writeFileSync(output, `${JSON.stringify(bom, null, 2)}\n`);
console.log(`✔ SBOM: ${components.map((c) => `${c.name}@${c.version}`).join(', ')}`);
