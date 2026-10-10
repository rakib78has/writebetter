# WriteBetter

A Chrome extension that helps you fix grammar and improve the clarity and tone of text you write on the web, without sending your text anywhere by default.

> **Status: Milestone 3 (local grammar engine).** WriteBetter loads text you select on a page and fixes its grammar and spelling, entirely on your device. Rewriting (tone, clarity) and replacing the text on the page come in later milestones (see [Roadmap](#roadmap)).

## What works today

- **Load your selection.** Select text in a text box on a web page, then either:
  - click the WriteBetter icon,
  - right-click and choose **Improve with WriteBetter**, or
  - press **Alt+Shift+W** (change it at `chrome://extensions/shortcuts`).

  The selected text appears in the popup.

- **Fix grammar.** Corrects common grammar, spelling and punctuation mistakes using [Harper](https://github.com/automattic/harper), which runs inside the extension. Your text never leaves your device. You see the corrected text and a list of every change.
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
- The corrected text is shown in the popup. Copying it, and replacing the text on the page, come in Milestone 4.
- Rewrite actions (Make Professional, Make Friendly, and so on) are not built yet.
- The extension is about 8 MB to download (16 MB installed), mostly the grammar engine.
- Only plain text boxes are supported: `<textarea>`, and `<input>` of type text, search, url or tel. Rich-text editors (such as Gmail's compose box) and fields inside embedded frames show a "paste it below instead" message. Editor support is planned for Milestone 5.
- Chrome doesn't let extensions read its own `chrome://` pages, the Chrome Web Store, or other extensions' pages.
- Word counts split on spaces, so languages written without spaces (Chinese, Japanese, Thai) count a whole run of text as one word.
- The build prints a harmless `SOURCEMAP_BROKEN` warning from the Tailwind plugin. It affects only CSS source maps, which are not shipped.

## Roadmap

1. **Scaffold** (done): build, popup, lint, tests, CI
2. **Text selection** (done): inputs and textareas, via icon, context menu or shortcut
3. **Local grammar engine** (done): Fix grammar with Harper, on-device
4. Rewrite actions, comparison, copy and replace
5. Rich-text editor compatibility
6. Full browser test journey
7. CI/CD and security hardening
8. Release readiness
9. Optional AI mode through a secure backend

## Documentation

- [Architecture](docs/architecture.md)
- [Grammar engine](docs/grammar-engine.md): choice, measurements, accuracy, limits
- [Security](docs/security.md)
- [Privacy](docs/privacy.md)
- [Testing](docs/testing.md) and [test cases](docs/test-cases.md)
- [Changelog](CHANGELOG.md)
