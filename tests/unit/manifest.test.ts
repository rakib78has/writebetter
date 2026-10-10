import { describe, expect, it } from 'vitest';
import { buildManifest } from '../../manifest.config.ts';

describe('buildManifest', () => {
  const manifest = buildManifest('1.2.3');

  // WB-UNIT-012
  it('is a Manifest V3 extension with the version it was given', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe('1.2.3');
  });

  // WB-SEC-001
  it('requests no permissions and no host access', () => {
    expect(manifest.permissions).toEqual([]);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.optional_host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
  });

  // WB-SEC-002
  it('only allows scripts bundled with the extension', () => {
    const csp = manifest.content_security_policy?.extension_pages ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-eval|unsafe-inline|https?:/);
  });

  // WB-UNIT-013
  it('keeps the description within the Chrome Web Store limit', () => {
    expect(manifest.description?.length ?? 0).toBeLessThanOrEqual(132);
  });
});
