# WriteBetter

A Chrome extension that helps you fix grammar and improve the clarity and tone of text you write on the web, without sending your text anywhere by default.

> **Status: Milestone 5 (rich-text editors).** Select text in a text box or a rich-text editor, fix its grammar and spelling on your device, see exactly what changed, then copy the result or put it back on the page, with formatting kept. Free, with no AI and no server.

## What works today

- **Load your selection.** Select text in a text box on a web page, then either:
  - click the WriteBetter icon,
  - right-click and choose **Improve with WriteBetter**, or
  - press **Alt+Shift+W** (change it at `chrome://extensions/shortcuts`).

  The selected text appears in the popup.

- **Fix grammar.** Corrects common grammar, spelling and punctuation mistakes using [Harper](https://github.com/automattic/harper), which runs inside the extension. Your text never leaves your device. You see the corrected text and a list of every change.
- **See every change.** Removed words are struck through and added words highlighted, so nothing changes without you seeing it.
- **Works in rich-text editors**: plain `contenteditable` (Gmail-style), ProseMirror, Quill and Lexical are tested. Only the words that change are edited, so bold text, links and paragraphs are kept. See [compatibility](docs/compatibility.md).
- **Copy, or replace on the page.** Replacing asks you to confirm first, refuses if you have edited the text since, and can be undone with the **Undo** button or Ctrl+Z in the page.
- **Safe by design.** Names, URLs, email addresses, code and file names are never "corrected". Anything WriteBetter is unsure about is listed for you to check, not changed.
- Clear messages when there is nothing to load: no selection, an unsupported field, or a page Chrome doesn't let extensions read.
- Password, verification-code and payment fields are never read.
- Type or paste text directly, with word and character counts and a 5,000-character limit. Counts handle emoji, accented characters and non-Latin scripts.
- No network access, and no access to any page until you invoke WriteBetter on it. See [privacy](docs/privacy.md).

## Requirements

- Node.js 22.12 or newer (the CI uses the version in [.nvmrc](.nvmrc))
- npm 10 or newer
- Google Chrome 127 or newer, to load the extension

## Setup

```sh
npm ci
npx playwright install chromium   # only needed for end-to-end tests and icon generation
```

## Commands

| Command                  | What it does                                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| `npm run build`          | Production build into `dist/`                                               |
| `npm run dev`            | Rebuilds `dist/` on every change (reload the extension in Chrome to see it) |
| `npm run validate:build` | Checks `dist/`: manifest, permissions, referenced files, no secrets         |
| `npm run package`        | Zips `dist/` (without source maps) into `writebetter-<version>.zip`         |
| `npm run lint`           | ESLint with strict, type-aware rules                                        |
| `npm run format:check`   | Prettier formatting check (`npm run format` fixes it)                       |
| `npm run typecheck`      | TypeScript type check                                                       |
| `npm test`               | Unit, component and integration tests (Vitest)                              |
| `npm run test:coverage`  | The same, with a coverage report and thresholds                             |
| `npm run test:e2e`       | Loads the built extension in real Chromium (Playwright). Build first.       |
| `npm run verify`         | Everything above except e2e and packaging, in CI order                      |
| `npm run icons`          | Re-renders `public/icons/*.png` from `assets/icon.svg`                      |

## Load the extension in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `dist` folder.
4. Pin WriteBetter from the puzzle-piece menu and click its icon to open the popup.

After rebuilding, click the reload icon on the WriteBetter card in `chrome://extensions`.

## Troubleshooting

- **"Manifest file is missing or unreadable"**: you selected the project folder instead of `dist`, or you haven't built yet.
- **End-to-end tests time out waiting for the service worker**: `dist/` is missing or stale. Run `npm run build` first. Tests use Playwright's Chromium, because branded Chrome ignores `--load-extension`.
- **`format:check` fails on Windows**: the files have CRLF line endings. `.gitattributes` forces LF on checkout; run `npm run format` to fix files that already exist.

## Known limitations

- Fix grammar is English only, and rule-based: it catches common mistakes but misses some (for example "your welcome"). See [grammar engine](docs/grammar-engine.md).
- No tone or style rewriting (Make Professional, Make Friendly, and so on). Those need an AI model, and WriteBetter is deliberately free and local-only for now.
- In a rich-text editor, undo with Ctrl+Z in the editor (there is no Undo button there). If an editor applies a change unexpectedly, WriteBetter stops and says so.
- The extension is about 8 MB to download (16 MB installed), mostly the grammar engine.
- Editors inside embedded frames (some TinyMCE and CKEditor setups) and canvas-based editors (Google Docs) are not supported. Specific sites have not been verified by hand yet; see [compatibility](docs/compatibility.md).
- Chrome doesn't let extensions read its own `chrome://` pages, the Chrome Web Store, or other extensions' pages.
- Word counts split on spaces, so languages written without spaces (Chinese, Japanese, Thai) count a whole run of text as one word.
- The build prints a harmless `SOURCEMAP_BROKEN` warning from the Tailwind plugin. It affects only CSS source maps, which are not shipped.

## Roadmap

1. **Scaffold** (done): build, popup, lint, tests, CI
2. **Text selection** (done): inputs and textareas, via icon, context menu or shortcut
3. **Local grammar engine** (done): Fix grammar with Harper, on-device
4. **Copy and replace** (done): change view, copy, confirmed replace with undo. AI rewrite actions are on hold (free, local-only for now).
5. **Rich-text editors** (done): contenteditable, ProseMirror, Quill, Lexical, tested
6. **Browser test journey** (done): core journey, robustness, accessibility scans, diagnostics
7. CI/CD and security hardening
8. Release readiness
9. Optional AI mode through a secure backend

## Documentation

- [Architecture](docs/architecture.md)
- [Editor compatibility](docs/compatibility.md): what is tested, what is not
- [Grammar engine](docs/grammar-engine.md): choice, measurements, accuracy, limits
- [Security](docs/security.md)
- [Privacy](docs/privacy.md)
- [Testing](docs/testing.md), [test cases](docs/test-cases.md) and [defects](docs/defects.md)
- [Changelog](CHANGELOG.md)
