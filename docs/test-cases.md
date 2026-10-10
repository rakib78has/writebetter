# Test cases

Status records the most recent execution. A test is marked **Pass** only after it has actually run.

Last run: 2026-10-10, local (Windows 11, Node 24.20.0, Playwright Chromium 1.64). CI has not run yet.

Preconditions for all automated cases: `npm ci`. E2E cases also need `npm run build` and the Playwright Chromium install.

## Unit

| ID          | Module     | Scenario                                       | Test data                              | Expected                              | Status | Automated |
| ----------- | ---------- | ---------------------------------------------- | -------------------------------------- | ------------------------------------- | ------ | --------- |
| WB-UNIT-001 | text-stats | Empty text                                     | `''`                                   | 0 characters, 0 words, not over limit | Pass   | Yes       |
| WB-UNIT-002 | text-stats | Whitespace only                                | space, tab, newline, space             | 4 characters, 0 words                 | Pass   | Yes       |
| WB-UNIT-003 | text-stats | Mixed whitespace between words                 | `'  Hello,\n\nworld!  How are\tyou? '` | 5 words                               | Pass   | Yes       |
| WB-UNIT-004 | text-stats | Emoji with skin-tone modifier                  | `👋🏽`                                   | 1 character (string.length is 4)      | Pass   | Yes       |
| WB-UNIT-005 | text-stats | Combining accent; ZWJ family emoji             | `e` + U+0301; `👨‍👩‍👧`                     | 1 character each                      | Pass   | Yes       |
| WB-UNIT-006 | text-stats | Punctuation and emoji alone are not words      | `'Great job 👏 — really !'`            | 3 words                               | Pass   | Yes       |
| WB-UNIT-007 | text-stats | URLs, emails, hyphenated words, decimals       | sentence with each                     | 9 words, each counted once            | Pass   | Yes       |
| WB-UNIT-008 | text-stats | Cyrillic and Arabic                            | `'Привет мир'`, `'مرحبا بالعالم'`      | 2 words each                          | Pass   | Yes       |
| WB-UNIT-009 | text-stats | Exactly at the limit                           | 5,000 × `a`                            | Not over limit                        | Pass   | Yes       |
| WB-UNIT-010 | text-stats | One over the limit                             | 5,001 × `a`                            | Over limit                            | Pass   | Yes       |
| WB-UNIT-011 | text-stats | Limit measured in characters, not UTF-16 units | 5,000 × `👋🏽`                           | Not over limit                        | Pass   | Yes       |
| WB-UNIT-012 | manifest   | Manifest V3 with the given version             | version `1.2.3`                        | `manifest_version` 3, version 1.2.3   | Pass   | Yes       |
| WB-UNIT-013 | manifest   | Description within Web Store limit             | n/a                                    | ≤ 132 characters                      | Pass   | Yes       |

## UI (component)

| ID        | Module | Scenario                           | Steps                        | Expected                                                | Status | Automated |
| --------- | ------ | ---------------------------------- | ---------------------------- | ------------------------------------------------------- | ------ | --------- |
| WB-UI-001 | popup  | Renders heading and labelled field | Render                       | `h1` "WriteBetter"; textbox named "Text to improve"     | Pass   | Yes       |
| WB-UI-002 | popup  | Initial state                      | Render                       | "0 words · 0 / 5,000 characters"; no alert; not invalid | Pass   | Yes       |
| WB-UI-003 | popup  | Live counts, singular/plural       | Type "Hello", then " world"  | "1 word · 5", then "2 words · 11"                       | Pass   | Yes       |
| WB-UI-004 | popup  | Over-limit warning                 | Paste 5,001 characters       | Alert "This text is too long"; field `aria-invalid`     | Pass   | Yes       |
| WB-UI-005 | popup  | Warning clears                     | Paste 5,001, press Backspace | No alert; field valid                                   | Pass   | Yes       |
| WB-UI-006 | popup  | Keyboard reachable                 | Press Tab                    | Textbox focused                                         | Pass   | Yes       |
| WB-UI-007 | popup  | Honest about missing features      | Render                       | "not available" notice; no buttons                      | Pass   | Yes       |

## End-to-end

| ID         | Scenario                       | Steps                                         | Expected                                        | Status      | Automated |
| ---------- | ------------------------------ | --------------------------------------------- | ----------------------------------------------- | ----------- | --------- |
| WB-E2E-001 | Extension loads; worker starts | Launch Chromium with `dist/`                  | Worker at `service-worker.js`; valid 32-char id | Pass        | Yes       |
| WB-E2E-002 | Popup opens and counts         | Open popup, fill "Their going to the park 👋🏽" | "5 words · 25 / 5,000 characters"               | Pass        | Yes       |
| WB-E2E-003 | Stylesheet applies             | Open popup, measure `main`                    | 360 px wide                                     | Pass        | Yes       |
| WB-E2E-004 | No errors or CSP violations    | Open popup, collect console and page errors   | None                                            | Pass        | Yes       |
| WB-E2E-005 | Loads in branded Google Chrome | Manual: Load unpacked `dist/`, click icon     | Popup opens; no errors on the extension card    | **Not run** | No        |

## Security

| ID         | Scenario                                   | Expected                                                                                               | Status              | Automated |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------- | --------- |
| WB-SEC-001 | No permissions or host access              | `permissions` empty; no host permissions or content scripts                                            | Pass                | Yes       |
| WB-SEC-002 | CSP allows bundled scripts only            | `script-src 'self'`; no unsafe-eval/inline, no remote hosts                                            | Pass                | Yes       |
| WB-SEC-003 | Typed markup is shown as text              | `<img onerror>` stays in the textarea; no `img` element created                                        | Pass                | Yes       |
| WB-SEC-004 | Build gate rejects permissions and secrets | Tampered `dist/` (added `tabs`, `<all_urls>`, fake `sk-ant-` key) fails `validate:build` with 4 errors | Pass (manual, once) | No        |
