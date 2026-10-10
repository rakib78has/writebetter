# Editor compatibility

WriteBetter claims support only for what is tested. "Tested" means an automated end-to-end test in Chromium reads a selection, applies fixes, and checks the result in the editor's own model, that formatting survives, and that Ctrl+Z undoes it.

## Tested

| Editing surface                            | Read selection | Replace | Formatting kept | Ctrl+Z | How                                      |
| ------------------------------------------ | -------------- | ------- | --------------- | ------ | ---------------------------------------- |
| `<textarea>`                               | Yes            | Yes     | n/a             | Yes    | Whole selection in one edit; Undo button |
| `<input>` text, search, url, tel           | Yes            | Yes     | n/a             | Yes    | As above                                 |
| Plain `contenteditable` (Gmail-style)      | Yes            | Yes     | Bold, links     | Yes    | Each fix applied in place                |
| ProseMirror 1.42 (TipTap, and many others) | Yes            | Yes     | Bold, links     | Yes    | Each fix applied in place                |
| Quill 2.0                                  | Yes            | Yes     | Bold, links     | Yes    | Each fix applied in place                |
| Lexical 0.51                               | Yes            | Yes     | Bold            | Yes    | Each fix applied in place                |

Tests: `tests/e2e/rich-editors.spec.ts` (editors), `tests/e2e/replace.spec.ts` (text fields). The editor libraries are dev dependencies used only to build test pages; they are not part of the extension.

## Not supported

| Surface                                            | What happens                               | Why                                                                                                   |
| -------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Editors inside an `<iframe>` (TinyMCE, CKEditor 4) | "Embedded frames aren't supported" + paste | `activeTab` doesn't grant cross-origin frames; injecting into all frames would need broad host access |
| Canvas-based editors (Google Docs)                 | "Select text in a text box"                | There is no text in the page to read or edit                                                          |
| `<input type="email">`, number, date               | "This kind of field isn't supported"       | No selection API, and not prose                                                                       |
| Password, one-time-code, payment fields            | Never read                                 | Privacy                                                                                               |

## Untested

Many sites build on the libraries above, but with their own plugins and customisations. Behaviour on a specific site (Gmail, Outlook, Notion, Slack, GitHub, Facebook) has **not been verified** and is listed as manual checks in [test-cases.md](test-cases.md). Other editor frameworks (Slate, Draft.js, CodeMirror, Monaco) are untested.

## How replacing works in a rich-text editor

1. Re-read the selection and check it is still exactly the text that was checked. If not, change nothing.
2. Turn each fix into a live DOM Range covering just the words that change. A fix that spans a line break or uneditable text (`contenteditable="false"`) is skipped and reported.
3. Apply the fixes from last to first. For each one: select it, **wait for the page's `selectionchange`**, insert the replacement with the browser's editing command, then **check the editor's whole text is exactly what it should be**.
4. If any check fails, stop at once and tell the user to review the page and press Ctrl+Z.

Step 3's wait exists because Lexical keeps its own copy of the selection, updated on `selectionchange`. Without the wait, Lexical applied the first fix to the _old_ selection and turned the paragraph into "Hi all, thewere". The check after each edit is the safety net: with the wait deliberately removed, WriteBetter caught the misplaced edit and stopped after it.

## What gets lost

- **Formatting inside a changed word.** "t**eh**" fixed to "the" takes the formatting at its start. Formatting elsewhere is untouched.
- **One Ctrl+Z per change** in some editors; others group nearby changes into one undo step.
