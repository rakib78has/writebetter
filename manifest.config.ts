/**
 * The extension manifest, written as typed code instead of a static JSON file.
 *
 * Keeping it in TypeScript means the compiler checks key names and value
 * shapes, and the version is read from package.json at build time so the two
 * can never drift apart. vite.config.ts emits the result as dist/manifest.json.
 *
 * Permissions are deliberately empty in Milestone 1: the popup works on text
 * typed into it, so it needs no access to any page. Every permission added
 * later must also be added to the allow-list in scripts/validate-build.mjs and
 * justified in docs/security.md.
 */

const ICONS = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
} as const;

export function buildManifest(version: string): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: 'WriteBetter',
    version,
    description: 'Fix grammar and improve the clarity and tone of your writing, privately.',
    minimum_chrome_version: '116',
    permissions: [],
    action: {
      default_popup: 'popup/index.html',
      default_title: 'WriteBetter',
      default_icon: ICONS,
    },
    icons: ICONS,
    background: {
      service_worker: 'service-worker.js',
      type: 'module',
    },
    content_security_policy: {
      // Only scripts bundled in the package may run on extension pages. This
      // is also what the Chrome Web Store requires: no remotely hosted code.
      extension_pages: "script-src 'self'; object-src 'self'; frame-ancestors 'none'",
    },
  };
}
