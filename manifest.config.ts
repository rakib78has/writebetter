/**
 * The extension manifest, written as typed code instead of a static JSON file.
 *
 * Keeping it in TypeScript means the compiler checks key names and value
 * shapes, and the version is read from package.json at build time so the two
 * can never drift apart. vite.config.ts emits the result as dist/manifest.json.
 *
 * Permissions are the minimum needed to read a selection when the user asks:
 * `activeTab` grants access to the current tab only after a click on the
 * icon, the context-menu entry or the keyboard shortcut, and `scripting` lets
 * the extension run its capture function in that tab at that moment. There
 * are no host permissions and no always-on content scripts. Every permission
 * must also be in the allow-list in scripts/validate-build.mjs and justified
 * in docs/security.md.
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
    // 127 is the first version where any extension may call
    // chrome.action.openPopup(), which the context menu relies on.
    minimum_chrome_version: '127',
    permissions: ['activeTab', 'contextMenus', 'scripting'],
    commands: {
      // The reserved `_execute_action` command opens the popup exactly as a
      // click on the icon does, including the activeTab grant.
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+W' },
      },
    },
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
      // 'wasm-unsafe-eval' lets the bundled grammar engine (WebAssembly)
      // compile. Despite the name, it allows WebAssembly only; JavaScript
      // eval() stays blocked.
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; frame-ancestors 'none'",
    },
  };
}
