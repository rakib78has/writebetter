# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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
