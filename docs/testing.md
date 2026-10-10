# Testing

## Layers

| Layer      | Tool                           | Runs in                         | Location           | Command                  |
| ---------- | ------------------------------ | ------------------------------- | ------------------ | ------------------------ |
| Unit       | Vitest                         | Node                            | `tests/unit/`      | `npm test`               |
| Component  | Vitest + React Testing Library | jsdom (simulated DOM)           | `tests/component/` | `npm test`               |
| End-to-end | Playwright                     | Real Chromium, extension loaded | `tests/e2e/`       | `npm run test:e2e`       |
| Build gate | `scripts/validate-build.mjs`   | Node, on `dist/`                | n/a                | `npm run validate:build` |

Integration tests (messaging between contexts, storage) are added in Milestone 2, when there is something to integrate.

## Why three layers

- **Unit tests** check logic exhaustively and fast: dozens of edge cases in milliseconds.
- **Component tests** check the UI the way a user or screen reader finds it: by role and accessible name (`getByRole('textbox', { name: 'Text to improve' })`), never by CSS class. If a test can't find an element by its accessible name, neither can assistive technology.
- **End-to-end tests** prove what jsdom cannot: the built extension loads, the manifest is correct, the CSP doesn't block anything, and the CSS actually applies.

## End-to-end setup

Extensions can't load into Playwright's default browser. `tests/e2e/fixtures.ts` launches a persistent Chromium context with `--load-extension=dist`, waits for the service worker, and derives the extension ID from its URL. It uses Playwright's bundled Chromium, because branded Google Chrome ignores `--load-extension`. Each test gets a fresh, temporary browser profile that is deleted afterwards.

Always run `npm run build` before `npm run test:e2e`. The tests exercise `dist/`, not the source.

Watch a run: `npx playwright test --headed`. On failure, traces and screenshots go to `test-results/`; view one with `npx playwright show-trace <file>`.

## Coverage

Coverage is measured on `src/shared/` and the popup components, with thresholds of 90% lines, functions and statements and 85% branches. `main.tsx` (the React mount call) and the service worker are excluded; the e2e suite covers them. Coverage is a floor, not a goal: a test that executes a line without asserting on its result adds coverage but no safety.

## Conventions

- Each test is tagged with its test-case ID in a comment (`// WB-UNIT-001`), traceable to [test-cases.md](test-cases.md).
- No arbitrary sleeps. Playwright's `expect` retries until its timeout; Testing Library's `user-event` awaits each interaction.
- Tests never call a paid API. Future AI tests will use a deterministic mock provider.

## Known limitations

- The e2e suite runs in Playwright's Chromium, not branded Chrome. Behavior is the same for everything tested so far, but a manual check in Chrome is still part of each milestone.
- Component tests run in jsdom, which does no layout. Visual layout (like the 360 px popup width) is checked in e2e.
