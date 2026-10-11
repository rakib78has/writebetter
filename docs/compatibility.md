# Editor compatibility

WriteBetter claims support only for what is tested. "Tested" means an automated end-to-end test in Chromium reads a selection, applies fixes, and checks the result in the editor's own model, that formatting survives, and that Ctrl+Z undoes it.

## Tested

| Editing surface                            | Read selection | Replace | Formatting kept | Ctrl+Z | How                                         |
| ------------------------------------------ | -------------- | ------- | --------------- | ------ | ------------------------------------------- |
| `<textarea>`                               | Yes            | Yes     | n/a             | Yes    | Whole selection in one edit; Undo button    |
| `<input>` text, search, url, tel           | Yes            | Yes     | n/a             | Yes    | As above                                    |
| Plain `contenteditable` (Gmail-style)      | Yes            | Yes     | Bold, links     | Yes    | Each fix applied in place                   |
| ProseMirror 1.42 (TipTap, and many others) | Yes            | Yes     | Bold, links     | Yes    | Each fix applied in place                   |
| Quill 2.0                                  | Yes            | Yes     | Bold, links     | Yes    | Each fix applied in place                   |
| Lexical 0.51                               | Yes            | Yes     | Bold            | Yes    | Each fix applied in place                   |
| Slate 0.127 (slate-react)                  | Yes            | Yes     | Bold, links     | Yes    | Each fix offered to Slate as an input event |
| TinyMCE 7.9, inline mode                   | Yes            | Yes     | Bold, links     | Yes    | Each fix applied in place                   |

Tests: `tests/e2e/rich-editors.spec.ts` (editors), `tests/e2e/replace.spec.ts` (text fields). The editor libraries are dev dependencies used only to build test pages; they are not part of the extension. TinyMCE 7 is GPL-2.0-or-later; it is never distributed, only used to build a local test page.

## Not supported

| Surface                                                         | What happens                               | Why                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Editors inside an `<iframe>` (TinyMCE classic mode, CKEditor 4) | "Embedded frames aren't supported" + paste | `activeTab` doesn't grant cross-origin frames; injecting into all frames would need broad host access |
| Canvas-based editors (Google Docs)                              | "Select text in a text box"                | There is no text in the page to read or edit                                                          |
| `<input type="email">`, number, date                            | "This kind of field isn't supported"       | No selection API, and not prose                                                                       |
| Password, one-time-code, payment fields                         | Never read                                 | Privacy                                                                                               |

## Untested

Many sites build on the libraries above, but with their own plugins and customisations. Behaviour on a specific site (Gmail, Outlook, Notion, Slack, GitHub, Facebook) has **not been verified** and is listed as manual checks in [test-cases.md](test-cases.md). Other editor frameworks (CodeMirror, Monaco, CKEditor 5) are untested.

**Draft.js** is untested on purpose. It is archived, and its only release (0.11.7) depends on `immutable` 3.x, which has three high-severity advisories with no fix. Adding it, even as a test-only dependency, would put known-vulnerable code into the build toolchain and fail the CI audit gate. Meta recommends Lexical instead, which is tested.

## How replacing works in a rich-text editor

1. Re-read the selection and check it is still exactly the text that was checked. If not, change nothing.
2. Turn each fix into a live DOM Range covering just the words that change. A fix that spans a line break or uneditable text (`contenteditable="false"`) is skipped and reported.
3. Apply the fixes from last to first. For each one:
   - select it, and **wait for the page's `selectionchange` plus 150 ms**, so editors that keep their own copy of the selection (Lexical; Slate, which throttles it to every 100 ms) have caught up;
   - **offer the edit as a `beforeinput` event**. An editor that applies edits through its own model (Slate, Lexical) takes it and cancels the event; otherwise the browser's editing command makes it, as for a plain `contenteditable`. Browsers fire no `beforeinput` for the editing command itself, so without this step Slate never saw the change;
   - **wait 150 ms and check the editor's whole text is exactly what it should be**. Waiting first means an editor that re-renders from its model and puts the old text back is caught.
4. After the last fix, signal the end of the edit with the release of a caret-movement key. TinyMCE saves an undo step on it, so Ctrl+Z works there too; other editors ignore it.
5. If any check fails, stop at once and tell the user to review the page and press Ctrl+Z.

Step 3's wait exists because Lexical keeps its own copy of the selection, updated on `selectionchange`. Without the wait, Lexical applied the first fix to the _old_ selection and turned the paragraph into "Hi all, thewere". The check after each edit is the safety net: with the wait deliberately removed, WriteBetter caught the misplaced edit and stopped after it.

## What WriteBetter can't detect

Checks compare the page's text, because an editor's internal model is out of reach from outside the page. An editor that ignores both `beforeinput` and changes to its DOM, and never re-renders, could show the corrected text while its model still holds the old one. All six tested editors are verified at the model level by the end-to-end tests; for an untested editor this is the remaining risk, and Copy is the safe fallback.

## What gets lost

- **Formatting inside a changed word.** "t**eh**" fixed to "the" takes the formatting at its start. Formatting elsewhere is untouched.
- **One Ctrl+Z per change** in some editors; others group nearby changes into one undo step.
