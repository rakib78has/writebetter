# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

The section below becomes `## [0.1.0] - YYYY-MM-DD` when 0.1.0 is released, after the manual checks in `docs/manual-qa.md` pass. See `docs/release-process.md`.

## [Unreleased]

First release: grammar and spelling fixes for text you select on the web, entirely on your device.

### Added

- **Fix grammar.** Select text in a text box or a rich-text editor, open WriteBetter (toolbar icon, right-click **Improve with WriteBetter**, or Alt+Shift+W) and click **Fix grammar**. Grammar and spelling are checked by [Harper](https://github.com/automattic/harper), which runs inside the extension.
- **See every change** before anything happens: removed and added words are marked inline, with the reason for each.
- **Copy** the corrected text, or **replace it on the page** after confirming. Bold text, links and paragraphs are kept, Ctrl+Z undoes it, and an Undo button is offered in plain text boxes.
- **Works in** ordinary text boxes and rich-text editors: Gmail-style editors and editors built on ProseMirror, Quill and Lexical are tested.
- **Careful with your words.** Names, web and email addresses, code, file names and HTML are never "corrected". Anything WriteBetter isn't sure about is listed for you to decide.
- **Safe replacing.** Nothing changes on the page without your confirmation, and never if you have edited the text since WriteBetter read it.
- **Private.** Text never leaves your device; nothing is stored; there is no account. Password, verification-code and payment fields are never read. WriteBetter can read a page only after you invoke it there.
- Accessible: keyboard operable, labelled for screen readers, and free of automatically detectable WCAG 2.1 A/AA issues in light and dark mode.

### Known limitations

- English only. The checker is rule-based: it catches common mistakes and misses some (for example "your welcome").
- No tone or style rewriting.
- Editors inside embedded frames and canvas-based editors such as Google Docs are not supported; copy and paste works there.
- Selections over about 5,000 characters are not checked.
- About 8 MB to download, mostly the grammar engine.

### Engineering

- Manifest V3; permissions `activeTab`, `contextMenus` and `scripting` only; no host permissions; strict CSP (`'wasm-unsafe-eval'` for the grammar engine only).
- 288 unit, component and integration tests; 42 end-to-end tests in real Chromium, including real ProseMirror, Quill and Lexical editors, accessibility scans, and failure on any extension-page error.
- Build gates for permissions, CSP, secrets, network calls, package contents and size. The release workflow publishes the zip with checksums and a CycloneDX SBOM. See `docs/security-review.md` and `docs/release-process.md`.
- Third-party licences ship in `THIRD_PARTY_NOTICES.txt`.
