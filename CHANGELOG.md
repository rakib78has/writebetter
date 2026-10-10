# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Load selected text from a text box into the popup, via the toolbar icon, a right-click **Improve with WriteBetter** entry, or Alt+Shift+W.
- Status messages for no selection, unsupported fields, rich-text editors, frames, and pages Chrome does not let extensions read.
- Password, one-time-code and payment-card fields are refused without reading their contents.
- Permissions `activeTab`, `contextMenus` and `scripting`; still no host permissions. Minimum Chrome version raised to 127.
- Integration tests with a fake Chrome API, and end-to-end tests that grant `activeTab` the way a real click does.
- Milestone 1 scaffold: a Manifest V3 extension built with Vite, React, TypeScript and Tailwind CSS.
- Popup with a text field and Unicode-aware word and character counts, with a 5,000-character limit.
- An empty background service worker, registered so later milestones can add to it.
- Unit, component and end-to-end smoke tests; build validation; packaging; CI workflow.
