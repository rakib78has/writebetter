# Testing

## Layers

| Layer       | Tool                           | Runs in                         | Location             | Command                  |
| ----------- | ------------------------------ | ------------------------------- | -------------------- | ------------------------ |
| Unit        | Vitest                         | Node                            | `tests/unit/`        | `npm test`               |
| Component   | Vitest + React Testing Library | jsdom (simulated DOM)           | `tests/component/`   | `npm test`               |
| Integration | Vitest + fake Chrome API       | Node                            | `tests/integration/` | `npm test`               |
| End-to-end  | Playwright                     | Real Chromium, extension loaded | `tests/e2e/`         | `npm run test:e2e`       |
| Build gate  | `scripts/validate-build.mjs`   | Node, on `dist/`                | n/a                  | `npm run validate:build` |

## What each layer is for

- **Unit tests** check logic exhaustively and fast: dozens of edge cases in milliseconds.
- **Component tests** check code that touches the DOM. React components are queried the way a user or screen reader finds them: by role and accessible name (`getByRole('textbox', { name: 'Text to improve' })`), never by CSS class. If a test can't find an element by its accessible name, neither can assistive technology. The capture function also runs here against jsdom, for its many edge cases.
- **Integration tests** also include the **grammar accuracy suite**, which runs the real Harper engine in Node through the full Fix grammar pipeline against `tests/fixtures/grammar-cases.json`. Known misses are recorded too: if a Harper upgrade starts catching one, its test fails, so the fixture is updated on purpose rather than silently.
- **Integration tests** check the modules that call Chrome APIs (`selection-source`, `context-menu`) with a small fake passed in as a parameter. Each module receives the API as an argument rather than reading the global `chrome`, so no global mocking is needed.
- **End-to-end tests** prove what the others cannot: the built extension loads, permissions actually grant (and withhold) access, the injected function survives minification, and the popup works against real pages.

## End-to-end setup

Extensions can't load into Playwright's default browser. `tests/e2e/fixtures.ts` launches a persistent Chromium context with `--load-extension=dist`. It uses Playwright's bundled Chromium, because branded Google Chrome ignores `--load-extension`. Each test gets a fresh, temporary browser profile that is deleted afterwards.

Always run `npm run build` before `npm run test:e2e`. The tests exercise `dist/`, not the source.

### Test pages

Pages in `tests/fixtures/` are served by Playwright's request interception at `https://fixture.test/` and `https://other.fixture.test/`. Nothing goes to the network. They must be served over http(s) because Chrome never lets extensions script `data:` or `file:` URLs.

### Simulating the user's click

Reading a page requires the `activeTab` grant, which Chrome gives only when the user invokes the extension. The `invokeExtensionOn(page)` fixture calls the DevTools protocol command `Extensions.triggerAction`, which is exactly what Chrome does when the toolbar icon is clicked: it grants `activeTab` and opens the popup. This needs the `--enable-unsafe-extension-debugging` flag and a browser-level CDP session, targeting the page's _tab_ target (not its page target).

Playwright cannot attach to the popup window that opens, so the fixture then opens the same `popup/index.html` in a tab with `?tab=<id>`. Everything except the popup's window chrome is therefore real: the permission grant, the injection, the page and the UI.

`openPopupWithoutAccess(page)` does the same without the click, to prove that access is refused.

### Harper in Node

`tests/helpers/harper-node.ts` loads the WebAssembly as a `data:` URL. harper.js's built-in Node loader breaks on Windows paths (it reads `new URL(path).pathname`, which gives `/C:/…`), and a `data:` URL works on every platform.

### What cannot be automated

- Clicking Chrome's native right-click menu. The handler is integration-tested, and WB-E2E-015 proves that `chrome.action.openPopup()` works in this Chromium. Manual check: WB-MAN-002.
- Pressing the keyboard shortcut. Chrome handles `_execute_action` itself; manual check WB-MAN-003.

Watch a run: `npx playwright test --headed`. On failure, traces and screenshots go to `test-results/`; view one with `npx playwright show-trace <file>`.

## Coverage

Coverage is measured on all of `src/`, with thresholds of 90% lines, functions and statements and 85% branches. Three thin entry points are excluded: `popup/main.tsx`, `background/service-worker.ts` and `writing/local/grammar.worker.ts`, which only wire real browser APIs together. The e2e suite exercises both. Coverage is a floor, not a goal: a test that executes a line without asserting on its result adds coverage but no safety.

## Conventions

- Each test is tagged with its test-case ID in a comment (`// WB-UNIT-001`), traceable to [test-cases.md](test-cases.md).
- No arbitrary sleeps. Playwright's `expect` retries until its timeout; Testing Library's `user-event` awaits each interaction.
- Tests never call a paid API. Future AI tests will use a deterministic mock provider.

## Known limitations

- The e2e suite runs in Playwright's Chromium, not branded Chrome. Manual checks in Chrome are listed in [test-cases.md](test-cases.md).
- jsdom implements neither `isContentEditable` nor iframe focus, so those two capture tests set the values Chromium reports. The e2e suite covers the rich-text case in a real browser.
- Component tests run in jsdom, which does no layout. Visual layout (like the 360 px popup width) is checked in e2e.
