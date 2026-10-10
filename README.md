# WriteBetter

A Chrome extension that helps you fix grammar and improve the clarity and tone of text you write on the web, without sending your text anywhere by default.

> **Status: Milestone 1 (scaffold).** The extension builds, loads in Chrome and opens a popup with a text field and live word and character counts. **No writing actions exist yet.** Grammar correction and rewriting arrive in later milestones (see [Roadmap](#roadmap)).

## What works today

- A popup where you can type or paste text and see word and character counts, with a 5,000-character limit.
- Counts that handle emoji, accented characters and non-Latin scripts correctly.
- No browser permissions and no network access. The extension cannot read any web page.

## Requirements

- Node.js 22.12 or newer (the CI uses the version in [.nvmrc](.nvmrc))
- npm 10 or newer
- Google Chrome 116 or newer, to load the extension

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
| `npm test`               | Unit and component tests (Vitest)                                           |
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

- No writing actions yet.
- Word counts split on spaces, so languages written without spaces (Chinese, Japanese, Thai) count a whole run of text as one word.
- The build prints a harmless `SOURCEMAP_BROKEN` warning from the Tailwind plugin. It affects only CSS source maps, which are not shipped.

## Roadmap

1. **Scaffold** (done): build, popup, lint, tests, CI
2. Text selection from inputs and textareas
3. Local grammar engine
4. Rewrite actions, comparison, copy and replace
5. Rich-text editor compatibility
6. Full browser test journey
7. CI/CD and security hardening
8. Release readiness
9. Optional AI mode through a secure backend

## Documentation

- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Privacy](docs/privacy.md)
- [Testing](docs/testing.md) and [test cases](docs/test-cases.md)
- [Changelog](CHANGELOG.md)
