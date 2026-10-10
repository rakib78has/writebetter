# Test cases

Status records the most recent execution. A test is marked **Pass** only after it has actually run.

Last run: 2026-10-10, local (Windows 11, Node 24.20.0, Playwright Chromium 1.64): 288 Vitest tests and 42 Playwright tests passed. CI passed for Milestones 1–3 (PRs #1 and #2).

Preconditions for all automated cases: `npm ci`. E2E cases also need `npm run build` and the Playwright Chromium install.

## Unit

| ID          | Module            | Scenario                                       | Test data                                                 | Expected                                          | Status | Automated |
| ----------- | ----------------- | ---------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- | ------ | --------- |
| WB-UNIT-001 | text-stats        | Empty text                                     | `''`                                                      | 0 characters, 0 words, not over limit             | Pass   | Yes       |
| WB-UNIT-002 | text-stats        | Whitespace only                                | space, tab, newline, space                                | 4 characters, 0 words                             | Pass   | Yes       |
| WB-UNIT-003 | text-stats        | Mixed whitespace between words                 | `'  Hello,\n\nworld!  How are\tyou? '`                    | 5 words                                           | Pass   | Yes       |
| WB-UNIT-004 | text-stats        | Emoji with skin-tone modifier                  | `👋🏽`                                                      | 1 character (string.length is 4)                  | Pass   | Yes       |
| WB-UNIT-005 | text-stats        | Combining accent; ZWJ family emoji             | `e` + U+0301; `👨‍👩‍👧`                                        | 1 character each                                  | Pass   | Yes       |
| WB-UNIT-006 | text-stats        | Punctuation and emoji alone are not words      | `'Great job 👏 — really !'`                               | 3 words                                           | Pass   | Yes       |
| WB-UNIT-007 | text-stats        | URLs, emails, hyphenated words, decimals       | sentence with each                                        | 9 words, each counted once                        | Pass   | Yes       |
| WB-UNIT-008 | text-stats        | Cyrillic and Arabic                            | `'Привет мир'`, `'مرحبا بالعالم'`                         | 2 words each                                      | Pass   | Yes       |
| WB-UNIT-009 | text-stats        | Exactly at the limit                           | 5,000 × `a`                                               | Not over limit                                    | Pass   | Yes       |
| WB-UNIT-010 | text-stats        | One over the limit                             | 5,001 × `a`                                               | Over limit                                        | Pass   | Yes       |
| WB-UNIT-011 | text-stats        | Limit measured in characters, not UTF-16 units | 5,000 × `👋🏽`                                              | Not over limit                                    | Pass   | Yes       |
| WB-UNIT-012 | manifest          | Manifest V3 with the given version             | version `1.2.3`                                           | `manifest_version` 3, version 1.2.3               | Pass   | Yes       |
| WB-UNIT-013 | manifest          | Description within Web Store limit             | n/a                                                       | ≤ 132 characters                                  | Pass   | Yes       |
| WB-UNIT-014 | capture (parse)   | Well-formed capture accepted                   | valid object                                              | Returned unchanged                                | Pass   | Yes       |
| WB-UNIT-015 | capture (parse)   | Data-less statuses accepted                    | `empty-selection`, `no-field`, `sensitive-field`          | Returned unchanged                                | Pass   | Yes       |
| WB-UNIT-016 | capture (parse)   | Unsupported reasons                            | 3 known, 1 unknown, missing                               | Known accepted; others rejected                   | Pass   | Yes       |
| WB-UNIT-017 | selection-message | A message for every outcome                    | all 11 outcomes                                           | Right tone and wording                            | Pass   | Yes       |
| WB-UNIT-018 | manifest          | Keyboard shortcut                              | n/a                                                       | `_execute_action` on Alt+Shift+W                  | Pass   | Yes       |
| WB-UNIT-019 | manifest          | Minimum Chrome version                         | n/a                                                       | 127 (first with `openPopup()` for all extensions) | Pass   | Yes       |
| WB-UNIT-020 | apply-fixes       | No issues                                      | `All good.`                                               | Unchanged                                         | Pass   | Yes       |
| WB-UNIT-021 | apply-fixes       | Several fixes, any order                       | `I has a apple.`                                          | `I have an apple.`                                | Pass   | Yes       |
| WB-UNIT-022 | apply-fixes       | First replacement only                         | `teh` → [the, tech]                                       | `the`                                             | Pass   | Yes       |
| WB-UNIT-023 | apply-fixes       | Removal fixes                                  | `and and`                                                 | `and`                                             | Pass   | Yes       |
| WB-UNIT-024 | apply-fixes       | Not-auto-fixable and replacement-less issues   | name, vague, typo                                         | Only the typo applied                             | Pass   | Yes       |
| WB-UNIT-025 | apply-fixes       | Overlapping fixes                              | `could of` and `of`                                       | First applied, second unresolved                  | Pass   | Yes       |
| WB-UNIT-026 | apply-fixes       | Offsets that don't match the text              | stale, out of range                                       | Both refused                                      | Pass   | Yes       |
| WB-UNIT-027 | apply-fixes       | Emoji around a fix                             | `Hi 👋🏽 teh 👨‍👩‍👧 end`                                        | Emoji intact                                      | Pass   | Yes       |
| WB-UNIT-028 | safeguards        | Protected text                                 | URL, www, email, @, #, code, tags, identifier, path, file | Each protected                                    | Pass   | Yes       |
| WB-UNIT-029 | safeguards        | Ordinary prose not protected                   | prose with 3.50, <, >                                     | Nothing protected                                 | Pass   | Yes       |
| WB-UNIT-030 | safeguards        | Issue in protected text                        | `constants.ts`                                            | Dropped                                           | Pass   | Yes       |
| WB-UNIT-031 | safeguards        | Capitalised misspelling                        | `Rakib`, `NASA`                                           | Reported, not auto-fixed                          | Pass   | Yes       |
| WB-UNIT-032 | safeguards        | Lowercase spelling, capitalised grammar        | `teh`, `Their`                                            | Auto-fixed                                        | Pass   | Yes       |
| WB-UNIT-033 | safeguards        | Input not mutated                              | issue object                                              | Unchanged                                         | Pass   | Yes       |
| WB-UNIT-050 | safeguards        | First word of a possible fragment              | `their is…`                                               | Not auto-capitalised                              | Pass   | Yes       |
| WB-UNIT-051 | safeguards        | Lone `i`; later capitals                       | `i went on monday`                                        | Both auto-fixed                                   | Pass   | Yes       |
| WB-UNIT-034 | protocol          | Valid requests                                 | prepare, check                                            | Accepted                                          | Pass   | Yes       |
| WB-UNIT-035 | protocol          | Valid responses                                | ready, error, result                                      | Accepted                                          | Pass   | Yes       |
| WB-UNIT-036 | protocol          | Unknown fields dropped                         | error with message; issue with html                       | Stripped                                          | Pass   | Yes       |
| WB-UNIT-037 | harper-issues     | Lint → Issue, plain-text mode                  | `teh`                                                     | Issue with offsets; `language: plaintext`         | Pass   | Yes       |
| WB-UNIT-038 | harper-issues     | Kind → category                                | 6 kinds                                                   | Mapped                                            | Pass   | Yes       |
| WB-UNIT-039 | harper-issues     | Style kinds ignored                            | 6 kinds                                                   | No issues                                         | Pass   | Yes       |
| WB-UNIT-040 | harper-issues     | Remove / insert-after suggestions              | `and `, `done`                                            | `""`, `done.`                                     | Pass   | Yes       |
| WB-UNIT-041 | harper-issues     | Replacement list                               | 6 suggestions                                             | ≤ 3 distinct, all changing the text               | Pass   | Yes       |
| WB-UNIT-042 | harper-issues     | No replacement                                 | lint with none                                            | `autoFix: false`                                  | Pass   | Yes       |
| WB-UNIT-043 | harper-issues     | Mismatched offsets                             | wrong problem text                                        | Dropped                                           | Pass   | Yes       |
| WB-UNIT-044 | harper-issues     | WebAssembly memory                             | 2 lints                                                   | Every lint, span, suggestion freed                | Pass   | Yes       |
| WB-UNIT-045 | worker-handler    | prepare                                        | n/a                                                       | `ready` after setup                               | Pass   | Yes       |
| WB-UNIT-046 | worker-handler    | check                                          | `fine`                                                    | `result`                                          | Pass   | Yes       |
| WB-UNIT-047 | worker-handler    | Engine failure                                 | setup or lint throws                                      | Bare `error`                                      | Pass   | Yes       |
| WB-UNIT-048 | worker-handler    | Malformed request with id                      | `type: eval`                                              | `error`                                           | Pass   | Yes       |
| WB-UNIT-049 | worker-handler    | No usable id                                   | null, missing, string                                     | Ignored                                           | Pass   | Yes       |
| WB-UNIT-052 | replace (parse)   | Valid statuses                                 | 6 statuses, extra field                                   | Accepted, extra dropped                           | Pass   | Yes       |

## UI (component)

| ID        | Module         | Scenario                                      | Steps                                       | Expected                                                            | Status | Automated |
| --------- | -------------- | --------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- | ------ | --------- |
| WB-UI-001 | popup          | Renders heading and labelled field            | Render                                      | `h1` "WriteBetter"; textbox named "Text to improve"                 | Pass   | Yes       |
| WB-UI-002 | popup          | Initial state                                 | Render, nothing selected                    | "0 words · 0 / 5,000 characters"; no alert; not invalid             | Pass   | Yes       |
| WB-UI-003 | popup          | Live counts, singular/plural                  | Type "Hello", then " world"                 | "1 word · 5", then "2 words · 11"                                   | Pass   | Yes       |
| WB-UI-004 | popup          | Over-limit warning                            | Paste 5,001 characters                      | Alert "This text is too long"; field `aria-invalid`                 | Pass   | Yes       |
| WB-UI-005 | popup          | Warning clears                                | Paste 5,001, press Backspace                | No alert; field valid                                               | Pass   | Yes       |
| WB-UI-006 | popup          | Keyboard reachable                            | Press Tab                                   | Textbox focused                                                     | Pass   | Yes       |
| WB-UI-007 | popup          | Honest about missing features                 | Render                                      | "not available" notice; no buttons                                  | Pass   | Yes       |
| WB-UI-008 | popup          | Loading state, then selection fills the field | Resolve loader with a capture               | Status "Reading your selection…", then "Loaded…"; field filled      | Pass   | Yes       |
| WB-UI-009 | popup          | Typed text is never overwritten               | Type, then resolve loader with a capture    | Field keeps the typed text                                          | Pass   | Yes       |
| WB-UI-010 | popup          | Read-only field mentioned                     | Capture with `readOnly`                     | Status mentions read-only                                           | Pass   | Yes       |
| WB-UI-011 | popup          | Non-capture outcomes explained                | Empty selection, password, restricted, rich | Matching status; field left empty                                   | Pass   | Yes       |
| WB-UI-012 | popup          | Selection read once per opening               | Render                                      | Loader called exactly once                                          | Pass   | Yes       |
| WB-UI-013 | popup          | Fix grammar availability                      | Empty, spaces, text, over limit             | Disabled, disabled, enabled, disabled                               | Pass   | Yes       |
| WB-UI-014 | popup          | Progress then results                         | Click; resolve with one fix                 | "Checking…", then corrected text, "Fixed 1 problem", message        | Pass   | Yes       |
| WB-UI-015 | popup          | Original preserved                            | Click Fix grammar                           | Input field unchanged                                               | Pass   | Yes       |
| WB-UI-016 | popup          | Review-only issues                            | Resolve with non-auto-fix issue             | "1 possible problem…"; no corrected text                            | Pass   | Yes       |
| WB-UI-017 | popup          | Nothing to fix                                | Resolve with []                             | "No problems found."                                                | Pass   | Yes       |
| WB-UI-018 | popup          | Results cleared on edit                       | Fix, then type                              | Results gone                                                        | Pass   | Yes       |
| WB-UI-019 | popup          | Late result for edited text                   | Click, type, then resolve                   | Result dropped                                                      | Pass   | Yes       |
| WB-UI-020 | popup          | Engine failure / timeout                      | Reject with each reason                     | Alert with matching advice; text kept; can retry                    | Pass   | Yes       |
| WB-UI-021 | popup          | Keyboard                                      | Focus button, Enter                         | Check runs                                                          | Pass   | Yes       |
| WB-UI-022 | result actions | Copy                                          | Click Copy                                  | Clipboard gets corrected text; "Copied"                             | Pass   | Yes       |
| WB-UI-023 | result actions | Copy fails                                    | Clipboard rejects                           | Manual-copy advice                                                  | Pass   | Yes       |
| WB-UI-024 | result actions | Confirm and replace                           | Replace, Enter on focused confirm           | Exact request sent; "Replaced"                                      | Pass   | Yes       |
| WB-UI-025 | result actions | Cancel                                        | Cancel button; Escape                       | Nothing sent; back to start                                         | Pass   | Yes       |
| WB-UI-026 | result actions | Undo                                          | Replace, then Undo                          | Reverse request; "original text is back"; Replace offered again     | Pass   | Yes       |
| WB-UI-027 | result actions | Each refusal                                  | 6 outcomes                                  | Matching alert; no blind retry; Copy still there                    | Pass   | Yes       |
| WB-UI-028 | result actions | No target                                     | Typed text; read-only                       | Copy only, with reason                                              | Pass   | Yes       |
| WB-UI-029 | change view    | Inline marks                                  | I has a apple.                              | del/ins with screen-reader labels                                   | Pass   | Yes       |
| WB-UI-030 | change view    | Removal                                       | and and done                                | del only                                                            | Pass   | Yes       |
| WB-UI-031 | popup          | Replace offered for page text                 | Captured, editable                          | Replace button; change view                                         | Pass   | Yes       |
| WB-UI-032 | popup          | Copy only                                     | Typed text; read-only field                 | No Replace button                                                   | Pass   | Yes       |
| WB-UI-033 | popup          | Fresh actions per result                      | Confirm, edit, check again                  | No stale confirmation                                               | Pass   | Yes       |
| WB-UI-034 | result actions | Rich confirmation, one change                 | Replace on page                             | "Make this change… Formatting such as bold text and links is kept." | Pass   | Yes       |
| WB-UI-035 | result actions | Rich confirmation, several                    | Two fixes                                   | "Make these 2 changes"                                              | Pass   | Yes       |
| WB-UI-036 | result actions | Rich request and undo hint                    | Confirm                                     | Fixes sent (not whole text); Ctrl+Z hint; no Undo button            | Pass   | Yes       |
| WB-UI-037 | result actions | Partial result                                | partial 2/3                                 | "Made 2 of 3 changes."                                              | Pass   | Yes       |
| WB-UI-038 | result actions | Unexpected editor behaviour                   | unexpected, 1 applied                       | Clear alert; count; Ctrl+Z advice                                   | Pass   | Yes       |

## Integration

| ID         | Module                | Scenario                                           | Expected                                                                 | Status | Automated |
| ---------- | --------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ | ------ | --------- |
| WB-INT-001 | capture (jsdom)       | Selection in a textarea                            | Only the selected part, with offsets                                     | Pass   | Yes       |
| WB-INT-002 | capture (jsdom)       | Inputs of type text, search, url, tel              | Selected text returned                                                   | Pass   | Yes       |
| WB-INT-003 | capture (jsdom)       | Emoji in selection                                 | Returned intact                                                          | Pass   | Yes       |
| WB-INT-004 | capture (jsdom)       | Caret with no selection                            | `empty-selection`                                                        | Pass   | Yes       |
| WB-INT-005 | capture (jsdom)       | Nothing focused                                    | `no-field`                                                               | Pass   | Yes       |
| WB-INT-006 | capture (jsdom)       | Ordinary autocomplete token (`name`)               | Captured normally                                                        | Pass   | Yes       |
| WB-INT-007 | capture (jsdom)       | Email and number inputs                            | `unsupported-field` / `input-type`                                       | Pass   | Yes       |
| WB-INT-008 | capture (jsdom)       | Read-only textarea                                 | Captured with `readOnly: true`                                           | Pass   | Yes       |
| WB-INT-009 | capture (jsdom)       | Contenteditable editor                             | Captured as rich text (was "unsupported" before Milestone 5)             | Pass   | Yes       |
| WB-INT-010 | capture (jsdom)       | Focused iframe                                     | `unsupported-field` / `frame`                                            | Pass   | Yes       |
| WB-INT-011 | capture (jsdom)       | Field inside an open shadow root                   | Captured                                                                 | Pass   | Yes       |
| WB-INT-012 | page-access           | Reads the popup window's active tab                | Queries active tab; injects `captureSelection` into it                   | Pass   | Yes       |
| WB-INT-013 | page-access           | Main frame only                                    | No `allFrames` in the injection target                                   | Pass   | Yes       |
| WB-INT-014 | page-access           | `?tab=42`                                          | Injects into tab 42 without querying                                     | Pass   | Yes       |
| WB-INT-015 | page-access           | Invalid `?tab=` values                             | `abc`, `-1`, `1.5`, empty, `1e3`, huge: `page-unavailable`, no injection | Pass   | Yes       |
| WB-INT-016 | page-access           | No active tab                                      | `page-unavailable`                                                       | Pass   | Yes       |
| WB-INT-017 | page-access           | Chrome refuses to script the page                  | `page-unavailable`                                                       | Pass   | Yes       |
| WB-INT-018 | page-access           | No result, undefined or malformed result           | `failed`                                                                 | Pass   | Yes       |
| WB-INT-019 | context-menu          | Registration                                       | `removeAll` then one `editable`-only item                                | Pass   | Yes       |
| WB-INT-020 | context-menu          | Creation failure                                   | Logged with Chrome's error message                                       | Pass   | Yes       |
| WB-INT-021 | context-menu          | Click on own item                                  | `openPopup({ windowId })`                                                | Pass   | Yes       |
| WB-INT-022 | context-menu          | Click on another item                              | Ignored                                                                  | Pass   | Yes       |
| WB-INT-023 | context-menu          | `openPopup` rejects                                | Warning logged, without the selected text; no throw                      | Pass   | Yes       |
| WB-INT-024 | grammar (real Harper) | 17 errors fixed                                    | Exact corrected text; nothing left for review                            | Pass   | Yes       |
| WB-INT-025 | grammar (real Harper) | 2 known misses                                     | Text unchanged (fails if an upgrade starts catching them)                | Pass   | Yes       |
| WB-INT-026 | grammar (real Harper) | Names, capitalised misspelling, fragments          | Held for review, exact output                                            | Pass   | Yes       |
| WB-INT-027 | grammar (real Harper) | 5 clean texts incl. URLs, code, identifiers        | No issues                                                                | Pass   | Yes       |
| WB-INT-028 | grammar (real Harper) | 5,000 characters                                   | Completes well under 2 s                                                 | Pass   | Yes       |
| WB-INT-029 | worker-checker        | Lazy start, one preparation, issues returned       | One worker; prepare once                                                 | Pass   | Yes       |
| WB-INT-030 | worker-checker        | Concurrent calls                                   | One prepare request                                                      | Pass   | Yes       |
| WB-INT-031 | worker-checker        | Worker fails to load                               | `unavailable`; worker terminated; next call recovers                     | Pass   | Yes       |
| WB-INT-032 | worker-checker        | Engine error                                       | `unavailable`                                                            | Pass   | Yes       |
| WB-INT-033 | worker-checker        | Check never answered                               | `timeout`; recovers                                                      | Pass   | Yes       |
| WB-INT-034 | worker-checker        | Prepare never answered                             | `timeout`                                                                | Pass   | Yes       |
| WB-INT-035 | worker-checker        | Malformed or unknown responses                     | Ignored                                                                  | Pass   | Yes       |
| WB-INT-036 | replace (jsdom)       | Replace and select                                 | Text replaced; new text selected                                         | Pass   | Yes       |
| WB-INT-037 | replace (jsdom)       | Events                                             | input (insertReplacementText) then change                                | Pass   | Yes       |
| WB-INT-038 | replace (jsdom)       | React-controlled input                             | onChange sees new value                                                  | Pass   | Yes       |
| WB-INT-039 | replace (jsdom)       | Removal                                            | Text removed                                                             | Pass   | Yes       |
| WB-INT-040 | replace (jsdom)       | Emoji around change                                | Intact                                                                   | Pass   | Yes       |
| WB-INT-041 | replace (jsdom)       | Over maxlength                                     | too-long; unchanged                                                      | Pass   | Yes       |
| WB-INT-042 | replace (jsdom)       | Read-only                                          | read-only; unchanged                                                     | Pass   | Yes       |
| WB-INT-043 | replace (jsdom)       | Focus lost                                         | field-gone                                                               | Pass   | Yes       |
| WB-INT-044 | page-access           | replaceOnPage injection                            | replaceInField with request, target tab only                             | Pass   | Yes       |
| WB-INT-045 | page-access           | Chrome refuses                                     | page-unavailable                                                         | Pass   | Yes       |
| WB-INT-046 | page-access           | Invalid tab                                        | page-unavailable; no injection                                           | Pass   | Yes       |
| WB-INT-047 | page-access           | Missing / malformed answer                         | failed                                                                   | Pass   | Yes       |
| WB-INT-048 | rich (jsdom)          | Selection across bold and link                     | Plain text, field rich                                                   | Pass   | Yes       |
| WB-INT-049 | rich (jsdom)          | Paragraphs, br, empty divs                         | Single newlines; no space before a break                                 | Pass   | Yes       |
| WB-INT-050 | rich (jsdom)          | Indented HTML source                               | Source whitespace ignored                                                | Pass   | Yes       |
| WB-INT-051 | rich (jsdom)          | Caret only                                         | empty-selection                                                          | Pass   | Yes       |
| WB-INT-052 | rich (jsdom)          | Selection outside focused editor                   | empty-selection                                                          | Pass   | Yes       |
| WB-INT-058 | rich (jsdom)          | Whitespace runs                                    | Collapsed to one space                                                   | Pass   | Yes       |
| WB-INT-053 | rich (jsdom)          | Fixes inside bold and link                         | Only words edited; b and a keep content and href; applied last to first  | Pass   | Yes       |
| WB-INT-054 | rich (jsdom)          | Fixes in two paragraphs                            | Both paragraphs intact                                                   | Pass   | Yes       |
| WB-INT-055 | rich (jsdom)          | Word split across formatting                       | Fixed                                                                    | Pass   | Yes       |
| WB-INT-056 | rich (jsdom)          | Fix spanning a line break                          | Skipped; partial 1/2                                                     | Pass   | Yes       |
| WB-INT-057 | rich (jsdom)          | Focus moved to a text field                        | field-gone                                                               | Pass   | Yes       |
| WB-INT-059 | capture (jsdom)       | Selection exactly at the read limit (40,000 units) | Captured                                                                 | Pass   | Yes       |
| WB-INT-060 | rich (jsdom)          | Oversized editor selection                         | too-long                                                                 | Pass   | Yes       |

## End-to-end

| ID         | Scenario                                                                         | Steps                                                     | Expected                                                                     | Status | Automated |
| ---------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ | --------- |
| WB-E2E-001 | Extension loads; worker starts                                                   | Launch Chromium with `dist/`                              | Worker at `service-worker.js`; valid 32-char id                              | Pass   | Yes       |
| WB-E2E-002 | Popup opens and counts                                                           | Open popup directly, fill "Their going to the park 👋🏽"    | "Can't read this page" status; "5 words · 25 / 5,000"                        | Pass   | Yes       |
| WB-E2E-003 | Stylesheet applies                                                               | Open popup, measure `main`                                | 360 px wide                                                                  | Pass   | Yes       |
| WB-E2E-004 | No errors or CSP violations                                                      | Open popup, collect console and page errors               | None                                                                         | Pass   | Yes       |
| WB-E2E-006 | Textarea selection                                                               | Select "their is a problem", invoke                       | Field filled; "4 words · 18"                                                 | Pass   | Yes       |
| WB-E2E-007 | Text input selection                                                             | Select "Quick question", invoke                           | Field filled                                                                 | Pass   | Yes       |
| WB-E2E-008 | Caret, nothing selected                                                          | Collapse selection, invoke                                | "No text is selected"; field empty                                           | Pass   | Yes       |
| WB-E2E-009 | No field focused                                                                 | Invoke on page                                            | "Select text in a text box"                                                  | Pass   | Yes       |
| WB-E2E-010 | Read-only field                                                                  | Select in read-only textarea, invoke                      | Field filled; status mentions read-only                                      | Pass   | Yes       |
| WB-E2E-011 | Caret in a rich-text editor                                                      | Focus contenteditable, invoke                             | "No text is selected"                                                        | Pass   | Yes       |
| WB-E2E-012 | Email field                                                                      | Focus email input, invoke                                 | "field isn't supported"                                                      | Pass   | Yes       |
| WB-E2E-013 | Browser page                                                                     | Invoke on `chrome://version`                              | "can't read this page"                                                       | Pass   | Yes       |
| WB-E2E-014 | Access ends on cross-origin navigation                                           | Invoke; navigate to other origin; read again              | "can't read this page"                                                       | Pass   | Yes       |
| WB-E2E-016 | Access survives same-origin navigation                                           | Invoke; navigate within site; select; read again          | Field filled                                                                 | Pass   | Yes       |
| WB-E2E-015 | `openPopup()` works from the worker                                              | Call from service worker                                  | Popup target appears                                                         | Pass   | Yes       |
| WB-E2E-017 | Fix grammar with the real engine                                                 | Type "I has a apple.", click                              | "I have an apple."; "Fixed 2 problems"                                       | Pass   | Yes       |
| WB-E2E-018 | Full journey                                                                     | Select fragment on page, invoke, Fix grammar              | "we were late and the build failed."; page unchanged                         | Pass   | Yes       |
| WB-E2E-019 | Replace after confirmation                                                       | Fix draft, Replace, check page, Yes                       | Page unchanged until Yes; then corrected; page saw input:insertText + change | Pass   | Yes       |
| WB-E2E-020 | Native undo                                                                      | Replace, Ctrl+Z in page                                   | Original restored                                                            | Pass   | Yes       |
| WB-E2E-021 | Undo button                                                                      | Replace, Undo                                             | Original restored                                                            | Pass   | Yes       |
| WB-E2E-022 | Copy                                                                             | Copy, paste into page field                               | Pasted text is the corrected text                                            | Pass   | Yes       |
| WB-E2E-023 | Rich editors: fix and replace (×4: contenteditable, ProseMirror, Quill, Lexical) | Select across bold and link, invoke, Fix grammar, confirm | Editor model holds fixed text; bold and link kept; 2 paragraphs              | Pass   | Yes       |
| WB-E2E-024 | Rich editors: Ctrl+Z (×4)                                                        | Replace, then Ctrl+Z in editor                            | Original text restored in the editor model                                   | Pass   | Yes       |
| WB-E2E-025 | Core journey in one test                                                         | Select, open, fix, review, copy, replace, undo            | Each step as the brief describes                                             | Pass   | Yes       |
| WB-E2E-026 | Repeated actions                                                                 | Double-click Fix grammar; edit; check again               | One result each time, for the latest text                                    | Pass   | Yes       |
| WB-E2E-027 | Text box removed from the page                                                   | Fix, remove field, replace                                | "no longer selected"; corrected text still available                         | Pass   | Yes       |
| WB-E2E-028 | Tab moved to another site                                                        | Fix, navigate cross-origin, replace                       | "can no longer reach that page"; new page untouched                          | Pass   | Yes       |
| WB-E2E-029 | Embedded frame                                                                   | Focus textarea in an iframe, invoke                       | Frame fallback message; pasted text still fixable                            | Pass   | Yes       |

## Accessibility

| ID          | Scenario                                    | Expected                                                                                      | Status      | Automated |
| ----------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------- | --------- |
| WB-A11Y-001 | axe-core WCAG 2.1 A/AA scan, light and dark | No violations in 6 popup states: no access, over limit, loaded, results, confirming, replaced | Pass        | Yes       |
| WB-A11Y-002 | Screen reader pass (NVDA or VoiceOver)      | Every control named; status and results announced                                             | **Not run** | No        |

## Manual (real Google Chrome)

These need a person, because they involve Chrome's own UI or branded Chrome.

| ID         | Scenario                       | Steps                                                                           | Expected                                                   | Status      |
| ---------- | ------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------- |
| WB-E2E-005 | Loads in branded Google Chrome | Load unpacked `dist/`, click icon                                               | Popup opens; no errors on the extension card               | **Not run** |
| WB-MAN-001 | Toolbar icon on a real site    | On any site, select text in a textarea, click the icon                          | Selected text appears in the popup                         | **Not run** |
| WB-MAN-002 | Context menu                   | Right-click selected text in a text box, choose **Improve with WriteBetter**    | Popup opens with the selection; menu absent outside fields | **Not run** |
| WB-MAN-003 | Keyboard shortcut              | Select text in a text box, press Alt+Shift+W                                    | Popup opens with the selection                             | **Not run** |
| WB-MAN-004 | Install shows no warning       | Load the extension; check its Details page                                      | No "Read and change your data" site-access warning         | **Not run** |
| WB-MAN-005 | Replace on real sites          | Replace in a textarea on a few common sites (e.g. a GitHub comment, a web form) | Text replaced; Ctrl+Z works; site notices the change       | **Not run** |
| WB-MAN-006 | Gmail compose                  | Select a sentence with a typo in a draft, Fix grammar, Replace                  | Fixed in place; formatting kept; Ctrl+Z works              | **Not run** |
| WB-MAN-007 | Other editors on real sites    | Repeat on e.g. Outlook web, Notion, a GitHub comment                            | As above, or a clear message                               | **Not run** |

## Security

| ID         | Scenario                                             | Expected                                                                                                                                            | Status              | Automated |
| ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------- |
| WB-SEC-001 | Only on-demand permissions                           | `activeTab`, `contextMenus`, `scripting`; no host permissions or content scripts                                                                    | Pass                | Yes       |
| WB-SEC-002 | CSP allows bundled scripts only                      | `script-src 'self'`; no unsafe-eval/inline, no remote hosts                                                                                         | Pass                | Yes       |
| WB-SEC-003 | Typed markup is shown as text                        | `<img onerror>` stays in the textarea; no `img` element created                                                                                     | Pass                | Yes       |
| WB-SEC-004 | Build gate rejects permissions and secrets           | Tampered `dist/` (added `tabs`, `<all_urls>`, fake `sk-ant-` key) fails `validate:build` with 4 errors                                              | Pass (manual, once) | No        |
| WB-SEC-005 | Unknown fields from the page are dropped             | Extra `html` field and stray `text` removed                                                                                                         | Pass                | Yes       |
| WB-SEC-006 | Malformed page results rejected                      | 13 malformed shapes all return null                                                                                                                 | Pass                | Yes       |
| WB-SEC-007 | Status message never repeats captured text           | Message excludes the text                                                                                                                           | Pass                | Yes       |
| WB-SEC-008 | Password value never read (jsdom)                    | `value` getter that throws is never called                                                                                                          | Pass                | Yes       |
| WB-SEC-009 | Sensitive autocomplete tokens refused (jsdom)        | `one-time-code`, `cc-number`, `cc-csc`, `current-password`, `new-password`                                                                          | Pass                | Yes       |
| WB-SEC-010 | Password field refused (Chromium)                    | Status warns; text not shown anywhere in popup                                                                                                      | Pass                | Yes       |
| WB-SEC-011 | One-time-code field refused (Chromium)               | Status warns; field empty                                                                                                                           | Pass                | Yes       |
| WB-SEC-012 | No access without user invocation (Chromium)         | Popup told the tab id, but not invoked: "can't read this page"                                                                                      | Pass                | Yes       |
| WB-SEC-013 | Markup in text is not "corrected"                    | `<img src=x onerror=…> teh end` → only `teh` fixed                                                                                                  | Pass                | Yes       |
| WB-SEC-014 | Malformed worker requests rejected                   | 6 shapes incl. oversized text                                                                                                                       | Pass                | Yes       |
| WB-SEC-015 | Malformed worker responses rejected                  | 9 shapes                                                                                                                                            | Pass                | Yes       |
| WB-SEC-016 | Errors never contain the text                        | Failure message excludes the draft                                                                                                                  | Pass                | Yes       |
| WB-SEC-017 | Markup in an issue message shown as text             | No `img` element created                                                                                                                            | Pass                | Yes       |
| WB-SEC-018 | No network while checking (Chromium)                 | Every request is to the extension itself; no console errors                                                                                         | Pass                | Yes       |
| WB-SEC-019 | Changed text never overwritten (jsdom)               | changed; field untouched                                                                                                                            | Pass                | Yes       |
| WB-SEC-020 | Sensitive fields never written or read               | password, one-time-code: field-gone, value getter never called                                                                                      | Pass                | Yes       |
| WB-SEC-021 | Replace needs explicit confirmation                  | First click sends nothing                                                                                                                           | Pass                | Yes       |
| WB-SEC-022 | Markup in change view shown as text                  | No img element                                                                                                                                      | Pass                | Yes       |
| WB-SEC-023 | Malformed replace results rejected                   | 6 shapes: failed                                                                                                                                    | Pass                | Yes       |
| WB-SEC-024 | Changed text never overwritten (Chromium)            | User rewrites draft after opening; Replace refused; their text kept                                                                                 | Pass                | Yes       |
| WB-SEC-025 | Rich editor text changed since checking              | changed; no edit attempted                                                                                                                          | Pass                | Yes       |
| WB-SEC-026 | Uneditable text never edited                         | contenteditable="false" part untouched; partial                                                                                                     | Pass                | Yes       |
| WB-SEC-027 | Misplaced editor edit caught (mutation test, manual) | With the selection wait removed, Lexical misapplied the first edit; WriteBetter stopped and showed the "didn't apply a change where expected" alert | Pass (manual, once) | No        |
| WB-SEC-028 | Oversized selection refused unread (jsdom)           | too-long; field value never read                                                                                                                    | Pass                | Yes       |
| WB-SEC-029 | Oversized selection refused (Chromium)               | 55,000-char selection: "too long to check"; popup field empty                                                                                       | Pass                | Yes       |
| WB-SEC-030 | Build gate rejects network calls and unknown URLs    | Planted fetch to an unknown host fails validate:build on both rules                                                                                 | Pass (manual, once) | No        |
| WB-SEC-031 | Package verification rejects a mismatched zip        | A file in dist/ but not in the zip fails verify:package                                                                                             | Pass (manual, once) | No        |

## Requirements traceability

The end-to-end requirements from the product brief (section 12.D) and where each is verified.

| #   | Requirement                                         | Verified by                                                  | Status           |
| --- | --------------------------------------------------- | ------------------------------------------------------------ | ---------------- |
| 1   | Extension loads correctly                           | WB-E2E-001                                                   | Pass             |
| 2   | Popup opens                                         | WB-E2E-002, WB-E2E-004                                       | Pass             |
| 3   | A supported text field can be processed             | WB-E2E-006, WB-E2E-007, WB-E2E-023                           | Pass             |
| 4   | Grammar correction produces the expected result     | WB-E2E-017, WB-INT-024 (17 fixtures)                         | Pass             |
| 5   | Each rewrite action uses the correct configuration  | Not applicable: only Fix grammar exists (no AI, by decision) | n/a              |
| 6   | Copying revised text works                          | WB-E2E-022                                                   | Pass             |
| 7   | Replacement only after explicit confirmation        | WB-E2E-019, WB-SEC-021                                       | Pass             |
| 8   | Replacement updates supported editors correctly     | WB-E2E-019, WB-E2E-023 (×4 editors)                          | Pass             |
| 9   | Original text preserved when a request fails        | WB-E2E-027, WB-E2E-028, WB-UI-020                            | Pass             |
| 10  | A failed request shows a useful error               | WB-E2E-027, WB-E2E-028, WB-UI-020, WB-UI-027                 | Pass             |
| 11  | Repeated actions give no duplicate or stale results | WB-E2E-026, WB-UI-018, WB-UI-019                             | Pass             |
| 12  | Selection changes do not overwrite newer text       | WB-SEC-024, WB-SEC-025                                       | Pass             |
| 13  | Restricted pages are handled gracefully             | WB-E2E-013, WB-SEC-012                                       | Pass             |
| 14  | Settings persist when intended                      | Not applicable: there are no settings yet                    | n/a              |
| 15  | Unsupported editors receive a safe fallback         | WB-E2E-012, WB-E2E-029                                       | Pass             |
| —   | Never read password fields                          | WB-SEC-008, WB-SEC-010, WB-SEC-020                           | Pass             |
| —   | No text sent over the network                       | WB-SEC-018                                                   | Pass             |
| —   | Accessible keyboard navigation                      | WB-UI-006, WB-UI-021, WB-UI-024, WB-UI-025, WB-A11Y-001      | Pass (automated) |

Defects found by these tests are recorded in [defects.md](defects.md).
