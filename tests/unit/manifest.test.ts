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
  it('requests only on-demand permissions and no host access', () => {
    expect(manifest.permissions).toEqual(['activeTab', 'contextMenus', 'scripting']);
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.optional_host_permissions).toBeUndefined();
    // No script runs on any page until the user invokes the extension.
    expect(manifest.content_scripts).toBeUndefined();
  });

  // WB-SEC-002
  it('only allows scripts bundled with the extension', () => {
    const csp = manifest.content_security_policy?.extension_pages ?? '';
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval';");
    // 'wasm-unsafe-eval' permits WebAssembly only. JavaScript eval, inline
    // scripts and remote hosts must stay blocked.
    expect(csp).not.toMatch(/'unsafe-eval'|unsafe-inline|https?:/);
  });

  // WB-UNIT-013
  it('keeps the description within the Chrome Web Store limit', () => {
    expect(manifest.description?.length ?? 0).toBeLessThanOrEqual(132);
  });

  // WB-UNIT-018
  it('maps a keyboard shortcut to opening the popup', () => {
    expect(manifest.commands?._execute_action?.suggested_key).toEqual({ default: 'Alt+Shift+W' });
  });

  // WB-UNIT-019
  it('requires Chrome 127, the first version where openPopup() is available to all extensions', () => {
    expect(manifest.minimum_chrome_version).toBe('127');
  });
});
