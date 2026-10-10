# Test cases

Status records the most recent execution. A test is marked **Pass** only after it has actually run.

Last run: 2026-10-10, local (Windows 11, Node 24.20.0, Playwright Chromium 1.64): 102 Vitest tests and 18 Playwright tests passed. Milestone 1 also passed in CI (PR #1).

Preconditions for all automated cases: `npm ci`. E2E cases also need `npm run build` and the Playwright Chromium install.

## Unit

| ID          | Module            | Scenario                                       | Test data                                        | Expected                                          | Status | Automated |
| ----------- | ----------------- | ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- | ------ | --------- |
| WB-UNIT-001 | text-stats        | Empty text                                     | `''`                                             | 0 characters, 0 words, not over limit             | Pass   | Yes       |
| WB-UNIT-002 | text-stats        | Whitespace only                                | space, tab, newline, space                       | 4 characters, 0 words                             | Pass   | Yes       |
| WB-UNIT-003 | text-stats        | Mixed whitespace between words                 | `'  Hello,\n\nworld!  How are\tyou? '`           | 5 words                                           | Pass   | Yes       |
| WB-UNIT-004 | text-stats        | Emoji with skin-tone modifier                  | `👋🏽`                                             | 1 character (string.length is 4)                  | Pass   | Yes       |
| WB-UNIT-005 | text-stats        | Combining accent; ZWJ family emoji             | `e` + U+0301; `👨‍👩‍👧`                               | 1 character each                                  | Pass   | Yes       |
| WB-UNIT-006 | text-stats        | Punctuation and emoji alone are not words      | `'Great job 👏 — really !'`                      | 3 words                                           | Pass   | Yes       |
| WB-UNIT-007 | text-stats        | URLs, emails, hyphenated words, decimals       | sentence with each                               | 9 words, each counted once                        | Pass   | Yes       |
| WB-UNIT-008 | text-stats        | Cyrillic and Arabic                            | `'Привет мир'`, `'مرحبا بالعالم'`                | 2 words each                                      | Pass   | Yes       |
| WB-UNIT-009 | text-stats        | Exactly at the limit                           | 5,000 × `a`                                      | Not over limit                                    | Pass   | Yes       |
| WB-UNIT-010 | text-stats        | One over the limit                             | 5,001 × `a`                                      | Over limit                                        | Pass   | Yes       |
| WB-UNIT-011 | text-stats        | Limit measured in characters, not UTF-16 units | 5,000 × `👋🏽`                                     | Not over limit                                    | Pass   | Yes       |
| WB-UNIT-012 | manifest          | Manifest V3 with the given version             | version `1.2.3`                                  | `manifest_version` 3, version 1.2.3               | Pass   | Yes       |
| WB-UNIT-013 | manifest          | Description within Web Store limit             | n/a                                              | ≤ 132 characters                                  | Pass   | Yes       |
| WB-UNIT-014 | capture (parse)   | Well-formed capture accepted                   | valid object                                     | Returned unchanged                                | Pass   | Yes       |
| WB-UNIT-015 | capture (parse)   | Data-less statuses accepted                    | `empty-selection`, `no-field`, `sensitive-field` | Returned unchanged                                | Pass   | Yes       |
| WB-UNIT-016 | capture (parse)   | Unsupported reasons                            | 3 known, 1 unknown, missing                      | Known accepted; others rejected                   | Pass   | Yes       |
| WB-UNIT-017 | selection-message | A message for every outcome                    | all 11 outcomes                                  | Right tone and wording                            | Pass   | Yes       |
| WB-UNIT-018 | manifest          | Keyboard shortcut                              | n/a                                              | `_execute_action` on Alt+Shift+W                  | Pass   | Yes       |
| WB-UNIT-019 | manifest          | Minimum Chrome version                         | n/a                                              | 127 (first with `openPopup()` for all extensions) | Pass   | Yes       |

## UI (component)

| ID        | Module | Scenario                                      | Steps                                       | Expected                                                       | Status | Automated |
| --------- | ------ | --------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- | ------ | --------- |
| WB-UI-001 | popup  | Renders heading and labelled field            | Render                                      | `h1` "WriteBetter"; textbox named "Text to improve"            | Pass   | Yes       |
| WB-UI-002 | popup  | Initial state                                 | Render, nothing selected                    | "0 words · 0 / 5,000 characters"; no alert; not invalid        | Pass   | Yes       |
| WB-UI-003 | popup  | Live counts, singular/plural                  | Type "Hello", then " world"                 | "1 word · 5", then "2 words · 11"                              | Pass   | Yes       |
| WB-UI-004 | popup  | Over-limit warning                            | Paste 5,001 characters                      | Alert "This text is too long"; field `aria-invalid`            | Pass   | Yes       |
| WB-UI-005 | popup  | Warning clears                                | Paste 5,001, press Backspace                | No alert; field valid                                          | Pass   | Yes       |
| WB-UI-006 | popup  | Keyboard reachable                            | Press Tab                                   | Textbox focused                                                | Pass   | Yes       |
| WB-UI-007 | popup  | Honest about missing features                 | Render                                      | "not available" notice; no buttons                             | Pass   | Yes       |
| WB-UI-008 | popup  | Loading state, then selection fills the field | Resolve loader with a capture               | Status "Reading your selection…", then "Loaded…"; field filled | Pass   | Yes       |
| WB-UI-009 | popup  | Typed text is never overwritten               | Type, then resolve loader with a capture    | Field keeps the typed text                                     | Pass   | Yes       |
| WB-UI-010 | popup  | Read-only field mentioned                     | Capture with `readOnly`                     | Status mentions read-only                                      | Pass   | Yes       |
| WB-UI-011 | popup  | Non-capture outcomes explained                | Empty selection, password, restricted, rich | Matching status; field left empty                              | Pass   | Yes       |
| WB-UI-012 | popup  | Selection read once per opening               | Render                                      | Loader called exactly once                                     | Pass   | Yes       |

## Integration

| ID         | Module           | Scenario                                 | Expected                                                                 | Status | Automated |
| ---------- | ---------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ------ | --------- |
| WB-INT-001 | capture (jsdom)  | Selection in a textarea                  | Only the selected part, with offsets                                     | Pass   | Yes       |
| WB-INT-002 | capture (jsdom)  | Inputs of type text, search, url, tel    | Selected text returned                                                   | Pass   | Yes       |
| WB-INT-003 | capture (jsdom)  | Emoji in selection                       | Returned intact                                                          | Pass   | Yes       |
| WB-INT-004 | capture (jsdom)  | Caret with no selection                  | `empty-selection`                                                        | Pass   | Yes       |
| WB-INT-005 | capture (jsdom)  | Nothing focused                          | `no-field`                                                               | Pass   | Yes       |
| WB-INT-006 | capture (jsdom)  | Ordinary autocomplete token (`name`)     | Captured normally                                                        | Pass   | Yes       |
| WB-INT-007 | capture (jsdom)  | Email and number inputs                  | `unsupported-field` / `input-type`                                       | Pass   | Yes       |
| WB-INT-008 | capture (jsdom)  | Read-only textarea                       | Captured with `readOnly: true`                                           | Pass   | Yes       |
| WB-INT-009 | capture (jsdom)  | Contenteditable editor                   | `unsupported-field` / `contenteditable`                                  | Pass   | Yes       |
| WB-INT-010 | capture (jsdom)  | Focused iframe                           | `unsupported-field` / `frame`                                            | Pass   | Yes       |
| WB-INT-011 | capture (jsdom)  | Field inside an open shadow root         | Captured                                                                 | Pass   | Yes       |
| WB-INT-012 | selection-source | Reads the popup window's active tab      | Queries active tab; injects `captureSelection` into it                   | Pass   | Yes       |
| WB-INT-013 | selection-source | Main frame only                          | No `allFrames` in the injection target                                   | Pass   | Yes       |
| WB-INT-014 | selection-source | `?tab=42`                                | Injects into tab 42 without querying                                     | Pass   | Yes       |
| WB-INT-015 | selection-source | Invalid `?tab=` values                   | `abc`, `-1`, `1.5`, empty, `1e3`, huge: `page-unavailable`, no injection | Pass   | Yes       |
| WB-INT-016 | selection-source | No active tab                            | `page-unavailable`                                                       | Pass   | Yes       |
| WB-INT-017 | selection-source | Chrome refuses to script the page        | `page-unavailable`                                                       | Pass   | Yes       |
| WB-INT-018 | selection-source | No result, undefined or malformed result | `failed`                                                                 | Pass   | Yes       |
| WB-INT-019 | context-menu     | Registration                             | `removeAll` then one `editable`-only item                                | Pass   | Yes       |
| WB-INT-020 | context-menu     | Creation failure                         | Logged with Chrome's error message                                       | Pass   | Yes       |
| WB-INT-021 | context-menu     | Click on own item                        | `openPopup({ windowId })`                                                | Pass   | Yes       |
| WB-INT-022 | context-menu     | Click on another item                    | Ignored                                                                  | Pass   | Yes       |
| WB-INT-023 | context-menu     | `openPopup` rejects                      | Warning logged, without the selected text; no throw                      | Pass   | Yes       |

## End-to-end

| ID         | Scenario                               | Steps                                                  | Expected                                              | Status | Automated |
| ---------- | -------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- | ------ | --------- |
| WB-E2E-001 | Extension loads; worker starts         | Launch Chromium with `dist/`                           | Worker at `service-worker.js`; valid 32-char id       | Pass   | Yes       |
| WB-E2E-002 | Popup opens and counts                 | Open popup directly, fill "Their going to the park 👋🏽" | "Can't read this page" status; "5 words · 25 / 5,000" | Pass   | Yes       |
| WB-E2E-003 | Stylesheet applies                     | Open popup, measure `main`                             | 360 px wide                                           | Pass   | Yes       |
| WB-E2E-004 | No errors or CSP violations            | Open popup, collect console and page errors            | None                                                  | Pass   | Yes       |
| WB-E2E-006 | Textarea selection                     | Select "their is a problem", invoke                    | Field filled; "4 words · 18"                          | Pass   | Yes       |
| WB-E2E-007 | Text input selection                   | Select "Quick question", invoke                        | Field filled                                          | Pass   | Yes       |
| WB-E2E-008 | Caret, nothing selected                | Collapse selection, invoke                             | "No text is selected"; field empty                    | Pass   | Yes       |
| WB-E2E-009 | No field focused                       | Invoke on page                                         | "Select text in a text box"                           | Pass   | Yes       |
| WB-E2E-010 | Read-only field                        | Select in read-only textarea, invoke                   | Field filled; status mentions read-only               | Pass   | Yes       |
| WB-E2E-011 | Rich-text editor                       | Focus contenteditable, invoke                          | "isn't supported yet … paste it below"                | Pass   | Yes       |
| WB-E2E-012 | Email field                            | Focus email input, invoke                              | "field isn't supported"                               | Pass   | Yes       |
| WB-E2E-013 | Browser page                           | Invoke on `chrome://version`                           | "can't read this page"                                | Pass   | Yes       |
| WB-E2E-014 | Access ends on cross-origin navigation | Invoke; navigate to other origin; read again           | "can't read this page"                                | Pass   | Yes       |
| WB-E2E-016 | Access survives same-origin navigation | Invoke; navigate within site; select; read again       | Field filled                                          | Pass   | Yes       |
| WB-E2E-015 | `openPopup()` works from the worker    | Call from service worker                               | Popup target appears                                  | Pass   | Yes       |

## Manual (real Google Chrome)

These need a person, because they involve Chrome's own UI or branded Chrome.

| ID         | Scenario                       | Steps                                                                        | Expected                                                   | Status      |
| ---------- | ------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------- |
| WB-E2E-005 | Loads in branded Google Chrome | Load unpacked `dist/`, click icon                                            | Popup opens; no errors on the extension card               | **Not run** |
| WB-MAN-001 | Toolbar icon on a real site    | On any site, select text in a textarea, click the icon                       | Selected text appears in the popup                         | **Not run** |
| WB-MAN-002 | Context menu                   | Right-click selected text in a text box, choose **Improve with WriteBetter** | Popup opens with the selection; menu absent outside fields | **Not run** |
| WB-MAN-003 | Keyboard shortcut              | Select text in a text box, press Alt+Shift+W                                 | Popup opens with the selection                             | **Not run** |
| WB-MAN-004 | Install shows no warning       | Load the extension; check its Details page                                   | No "Read and change your data" site-access warning         | **Not run** |

## Security

| ID         | Scenario                                      | Expected                                                                                               | Status              | Automated |
| ---------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------- | --------- |
| WB-SEC-001 | Only on-demand permissions                    | `activeTab`, `contextMenus`, `scripting`; no host permissions or content scripts                       | Pass                | Yes       |
| WB-SEC-002 | CSP allows bundled scripts only               | `script-src 'self'`; no unsafe-eval/inline, no remote hosts                                            | Pass                | Yes       |
| WB-SEC-003 | Typed markup is shown as text                 | `<img onerror>` stays in the textarea; no `img` element created                                        | Pass                | Yes       |
| WB-SEC-004 | Build gate rejects permissions and secrets    | Tampered `dist/` (added `tabs`, `<all_urls>`, fake `sk-ant-` key) fails `validate:build` with 4 errors | Pass (manual, once) | No        |
| WB-SEC-005 | Unknown fields from the page are dropped      | Extra `html` field and stray `text` removed                                                            | Pass                | Yes       |
| WB-SEC-006 | Malformed page results rejected               | 13 malformed shapes all return null                                                                    | Pass                | Yes       |
| WB-SEC-007 | Status message never repeats captured text    | Message excludes the text                                                                              | Pass                | Yes       |
| WB-SEC-008 | Password value never read (jsdom)             | `value` getter that throws is never called                                                             | Pass                | Yes       |
| WB-SEC-009 | Sensitive autocomplete tokens refused (jsdom) | `one-time-code`, `cc-number`, `cc-csc`, `current-password`, `new-password`                             | Pass                | Yes       |
| WB-SEC-010 | Password field refused (Chromium)             | Status warns; text not shown anywhere in popup                                                         | Pass                | Yes       |
| WB-SEC-011 | One-time-code field refused (Chromium)        | Status warns; field empty                                                                              | Pass                | Yes       |
| WB-SEC-012 | No access without user invocation (Chromium)  | Popup told the tab id, but not invoked: "can't read this page"                                         | Pass                | Yes       |
