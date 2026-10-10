# Security

## Threat model (Milestone 1)

| Asset                 | Threat                                     | Current mitigation                                                                                                                 |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Text the user types   | Rendered as HTML and executes script (XSS) | Rendered only through React, which escapes text. `innerHTML`, `outerHTML`, `insertAdjacentHTML` banned by ESLint. Test WB-SEC-003. |
| Text the user types   | Leaked through logs                        | `console.log` banned by ESLint. Nothing logs user text.                                                                            |
| The extension package | Ships a credential                         | `validate:build` scans every bundled file for key patterns and fails the build.                                                    |
| The extension package | Runs code fetched at runtime               | CSP `script-src 'self'`; `validate:build` rejects remote scripts and imports.                                                      |
| The user's browsing   | Extension gains broad page access          | No permissions at all; `validate:build` fails on any permission not in its allow-list.                                             |
| Build toolchain       | Compromised dependency or GitHub Action    | Exact versions and a committed lockfile, `npm ci`, `npm audit` in CI, actions pinned to commit SHAs.                               |

## Permissions

**Current: none.** The popup only works with text typed into it.

**Planned for Milestone 2**, to be confirmed then:

| Permission     | Why                                                                                                       | Install warning? |
| -------------- | --------------------------------------------------------------------------------------------------------- | ---------------- |
| `activeTab`    | Temporary access to the _current_ tab, granted only when the user clicks the icon, menu item or shortcut. | No               |
| `scripting`    | Inject the content script into that tab at that moment, instead of into every page.                       | No               |
| `contextMenus` | The right-click "WriteBetter" entry.                                                                      | No               |
| `storage`      | Save settings (not text).                                                                                 | No               |

The alternative, a content script declared for `<all_urls>`, would run on every page the user visits and show the warning _"Read and change all your data on all websites"_. Combining `activeTab` with on-demand injection gives the same functionality, triggered by the user, with no standing access. The cost: the extension cannot react to a selection until the user invokes it, which fits the product anyway.

## Rules for contributors

- Never add a permission without updating `ALLOWED_PERMISSIONS` in `scripts/validate-build.mjs` and this document.
- Never put API keys, tokens or provider URLs with credentials in extension code. A remote AI mode must go through a backend that holds the keys.
- Validate every message received from another extension context.
- Never log user text, including in error messages.
