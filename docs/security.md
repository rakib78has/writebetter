# Security

## Threat model (Milestone 5)

| Asset                 | Threat                                                        | Current mitigation                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text on web pages     | Extension reads pages the user never asked it to              | No host permissions, no always-on content scripts. Only `activeTab`: access to one tab, after the user invokes the extension on it. Tests WB-SEC-001, WB-SEC-012.            |
| Text on web pages     | Extension reads more than the selection                       | The capture function reads only `value.slice(start, end)` of the focused field. Nothing else on the page is touched.                                                         |
| Passwords and codes   | Extension reads a password, one-time code or card number      | Fields with `type="password"` or `autocomplete` tokens `current-password`, `new-password`, `one-time-code` or `cc-*` are refused before their value is read. WB-SEC-008–011. |
| The popup             | A hostile page returns crafted data from the capture function | `parseCaptureResult()` validates the shape and copies only known fields. Anything else is rejected. WB-SEC-005, WB-SEC-006.                                                  |
| Text the user types   | Rendered as HTML and executes script (XSS)                    | Rendered only through React, which escapes text. `innerHTML`, `outerHTML`, `insertAdjacentHTML` banned by ESLint. WB-SEC-003.                                                |
| Text the user types   | Leaked through logs or messages                               | `console.log` banned by ESLint. No code logs user text; the context-menu handler ignores Chrome's `selectionText`. WB-SEC-007, WB-INT-023.                                   |
| The extension package | Ships a credential                                            | `validate:build` scans every bundled file for key patterns and fails the build.                                                                                              |
| Grammar engine        | Sends text over the network                                   | Harper is bundled; its only fetch is its own `.wasm` from the package. An e2e test fails on any request outside the extension (WB-SEC-018).                                  |
| Grammar engine        | Changes text in harmful ways                                  | Safeguards: no changes to URLs, emails, code, tags, identifiers; no auto-correction of names or of the first word. See grammar-engine.md.                                    |
| Page text             | Changed without the user agreeing                             | Two explicit clicks ("Replace on page", "Yes, replace"); nothing runs on the page before the second. WB-SEC-021.                                                             |
| Page text             | Newer edits overwritten by a stale result                     | The page checks the exact expected text at the exact offsets before changing anything; refuses otherwise. WB-SEC-019, WB-SEC-024.                                            |
| Page text             | Partial or truncated change                                   | Refuses up front if the result would exceed `maxlength`; verifies the new text is present afterwards.                                                                        |
| Rich-text editor text | An editor applies a change to the wrong place                 | Wait for `selectionchange` before each edit; verify the editor's whole text after each; stop at once if it differs. Mutation-tested against Lexical.                         |
| Rich-text editor text | Formatting or structure destroyed                             | Only changed words are edited; fixes spanning breaks or `contenteditable="false"` text are skipped. WB-SEC-026, WB-E2E-023.                                                  |
| Sensitive fields      | Written to, or read during a write                            | `replaceInField` rejects password, one-time-code and payment fields before touching their value. WB-SEC-020.                                                                 |
| Worker messages       | Malformed message, or an error that echoes text               | Both directions validated in `protocol.ts`; error responses carry no message. WB-SEC-014–016.                                                                                |
| The extension package | Runs code fetched at runtime                                  | CSP `script-src 'self'`; `validate:build` rejects remote scripts and imports.                                                                                                |
| The user's browsing   | Permissions quietly grow                                      | `validate:build` fails on any permission outside its allow-list, and on any host permission.                                                                                 |
| Build toolchain       | Compromised dependency or GitHub Action                       | Exact versions and a committed lockfile, `npm ci`, `npm audit` in CI, actions pinned to commit SHAs.                                                                         |

## Permissions

| Permission     | Why                                                                                                                           | Install warning? |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `activeTab`    | Temporary access to the current tab, granted only when the user clicks the icon, picks the menu item or presses the shortcut. | No               |
| `scripting`    | Run the capture function in that tab at that moment, instead of a content script on every page.                               | No               |
| `contextMenus` | The right-click "Improve with WriteBetter" entry on text fields.                                                              | No               |

`storage` was planned for this milestone but is not needed yet, so it is not requested. It will be added when settings exist.

### Why not a content script on every page?

A content script declared for `<all_urls>` would run on every page the user visits and show the install warning _"Read and change all your data on all websites"_. `activeTab` with on-demand injection gives the same capability, only when the user asks, with no standing access. The cost: WriteBetter cannot react to a selection (for example, by showing a floating button) until the user invokes it. That fits a tool that must never act on text without being asked.

### How long access lasts

Chrome grants `activeTab` for one tab and keeps it until that tab **navigates to a different origin** or closes. It survives navigation within the same site (WB-E2E-016) and is revoked by a cross-origin navigation (WB-E2E-014). During that window the extension could technically script the tab again, but it only does so when the popup opens.

### Frames

The capture function runs only in the tab's main frame. `activeTab` doesn't cover cross-origin iframes, so injecting into all frames would fail on most sites anyway. A focused iframe is reported as unsupported.

Dev-only dependency note: `quill` 2.0.3 has a low-severity advisory (XSS in its HTML export). Quill is used only to build local test pages, never shipped, and the tests do not use HTML export.

## Content Security Policy

`script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; frame-ancestors 'none'`

Only scripts in the package can run. `'wasm-unsafe-eval'` is required to compile the grammar engine's WebAssembly; it does not permit JavaScript `eval()` or `new Function()`. `validate:build` rejects `'unsafe-eval'`, `unsafe-inline` and any remote host.

## Dependencies

Runtime dependencies (shipped to users): `react`, `react-dom`, `harper.js` and their dependencies `scheduler` and `fflate`. All are MIT or Apache-2.0; `THIRD_PARTY_NOTICES.txt` in the package carries their licences. Versions are exact and locked. Harper was checked for network use: its code fetches only the WebAssembly URL it is given.

## The `?tab=` popup parameter

The popup reads the active tab of its window. Opened as a page with `?tab=<id>`, it reads that tab instead; the end-to-end tests use this. It grants nothing on its own: Chrome still refuses the read unless the user invoked the extension on that tab (WB-SEC-012). Web pages cannot open the popup URL at all, because it is not listed in `web_accessible_resources`. The value must be a plain run of digits (WB-INT-015).

## Rules for contributors

- Never add a permission without updating `ALLOWED_PERMISSIONS` in `scripts/validate-build.mjs` and this document.
- Never put API keys, tokens or provider URLs with credentials in extension code. A remote AI mode must go through a backend that holds the keys.
- Validate everything received from a page or another extension context before using it.
- Never log user text, including in error messages.
- Code injected into pages (`src/content/`) must be self-contained, and must never read more than it needs.
