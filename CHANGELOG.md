# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Release workflow: on a version tag, re-runs all CI gates, checks version consistency, and publishes a GitHub release with the zip, SHA-256 checksums, a CycloneDX SBOM and the CHANGELOG notes. Chrome Web Store publishing stays manual.
- `verify:package`, `check:version`, `release:notes` and `sbom` scripts.
- Build gate: no URLs outside a reviewed allow-list and no network APIs outside the grammar worker in shipped code.
- CI: `npm audit signatures`; checkouts no longer persist the token; Dependabot for npm and GitHub Actions.
- `docs/security-review.md` and `docs/release-process.md`.

### Fixed

- Very large selections (over 40,000 UTF-16 units) are refused before their text is read, instead of being copied into the popup.
- Removed Vite's module-preload polyfill, an unnecessary `fetch` in the popup.

- End-to-end: the core user journey as one test; repeated actions; a text box removed mid-flow; a tab that moved to another site; an editor inside an embedded frame.
- Automated accessibility scans (axe-core, WCAG 2.1 A/AA) of every popup state, light and dark. No violations.
- Every end-to-end test now fails on any error logged by an extension page, with the log attached.
- `docs/defects.md` and a requirements traceability table in `docs/test-cases.md`.

- **Rich-text editors**: read and replace in `contenteditable`, tested against real ProseMirror, Quill and Lexical editors and a Gmail-style editor. Fixes are applied one word at a time, so bold text, links and paragraphs are kept, and each is verified after it lands; if an editor puts a change somewhere unexpected, WriteBetter stops and says so.
- Text in editors is read as displayed: whitespace runs collapsed, line and paragraph breaks as single newlines.
- `docs/compatibility.md`: tested, unsupported and untested editors.

### Changed

- The two injected page functions are merged into one, `runInPage` (`src/content/page-script.ts`), which reads and writes the page and shares helpers. Replacing is now asynchronous.

- **Change view**: the original text with each fix marked inline (removed and added text, announced to screen readers).
- **Copy** the corrected text.
- **Replace on page**, after an explicit confirmation step. Refuses, changing nothing, if the text on the page has changed, the field is gone or read-only, or the result would exceed `maxlength`. Uses the browser's own editing command, so Ctrl+Z in the page undoes it and page frameworks see a normal edit; an **Undo** button does the same from the popup.
- Popup background now follows dark mode everywhere.

### Changed

- `src/popup/selection-source.ts` renamed to `page-access.ts`, now also home of `replaceOnPage`.

- **Fix grammar**, powered by Harper (harper.js 2.10.0, Apache-2.0) running locally as WebAssembly in a Web Worker. Shows the corrected text, what was fixed, and what to check yourself.
- Safeguards: URLs, emails, code, tags, file names and identifiers are never changed; capitalised words and the first word are never auto-corrected.
- CSP now includes `'wasm-unsafe-eval'` (WebAssembly only; JavaScript eval stays blocked).
- `THIRD_PARTY_NOTICES.txt` with the licence of every bundled package, generated at build time.
- Build gate: exactly one `.wasm` file, 20 MB size budget.
- Grammar accuracy regression suite running the real engine in Node.

- Load selected text from a text box into the popup, via the toolbar icon, a right-click **Improve with WriteBetter** entry, or Alt+Shift+W.
- Status messages for no selection, unsupported fields, rich-text editors, frames, and pages Chrome does not let extensions read.
- Password, one-time-code and payment-card fields are refused without reading their contents.
- Permissions `activeTab`, `contextMenus` and `scripting`; still no host permissions. Minimum Chrome version raised to 127.
- Integration tests with a fake Chrome API, and end-to-end tests that grant `activeTab` the way a real click does.
- Milestone 1 scaffold: a Manifest V3 extension built with Vite, React, TypeScript and Tailwind CSS.
- Popup with a text field and Unicode-aware word and character counts, with a 5,000-character limit.
- An empty background service worker, registered so later milestones can add to it.
- Unit, component and end-to-end smoke tests; build validation; packaging; CI workflow.
