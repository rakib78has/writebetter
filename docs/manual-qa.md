# Manual QA checklist

Checks that need a person and real Google Chrome. About 30 minutes. Record each result in [test-cases.md](test-cases.md) (change **Not run** to **Pass** or **Fail**, with a note).

Why manual: Playwright drives its own Chromium build. Branded Google Chrome refuses automated unpacked loading (`--load-extension` is ignored, and `Extensions.loadUnpacked` reported success in Chrome 155 but the extension never started), and no tool can click Chrome's own menus or press browser-level shortcuts.

## Setup

1. `npm ci && npm run build`
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, choose `dist`.
3. Pin WriteBetter from the puzzle-piece menu.

## 1. Install (WB-E2E-005, WB-MAN-004)

- [ ] The card shows WriteBetter 0.1.0 with no errors ("Errors" button absent).
- [ ] **Details** shows no site access ("This extension has no special site access" or similar). No "Read and change all your data" warning.

## 2. Entry points (WB-MAN-001 to 003)

Use any page with a textarea, for example a GitHub issue comment box, or the [MDN textarea example](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea).

- [ ] Type `I has a apple.`, select it, **click the icon**: the popup shows the text.
- [ ] Select it again, **right-click → Improve with WriteBetter**: the popup opens with the text.
- [ ] The right-click entry does **not** appear outside text fields.
- [ ] Select it again, press **Alt+Shift+W**: the popup opens with the text. (If nothing happens, check `chrome://extensions/shortcuts`: another extension may own the shortcut.)

## 3. Fix, copy, replace (WB-MAN-005)

- [ ] **Fix grammar** shows "I have an apple." and the change view.
- [ ] **Copy**, then paste somewhere: the corrected text arrives.
- [ ] **Replace on page → Yes, replace**: the textarea shows the corrected text, selected.
- [ ] **Ctrl+Z** in the textarea restores the original.
- [ ] On a site that reacts to typing (for example a comment box with a live preview or character counter), the site notices the replaced text.

## 4. Rich-text editors (WB-MAN-006, 007)

- [ ] **Gmail**: in a new draft, type `Hi all, we was late and teh build failed.`, make "was late" bold, select the sentence, fix and replace. Expect: fixed in place, bold kept, Ctrl+Z undoes.
- [ ] Repeat in one more editor you use (Outlook web, Notion, Slack, a GitHub comment). Record which, and the result. A clear "can't" message counts as a pass; silent wrong edits are a fail to report.

## 5. Privacy and restricted pages

- [ ] Select text in a **password** field and open WriteBetter: "never reads password…", and the text box stays empty.
- [ ] Open WriteBetter on `chrome://extensions`: "can't read this page".
- [ ] Open DevTools on the popup (right-click inside it → Inspect), **Network** tab, run Fix grammar: no requests except the extension's own files.

## 6. Screen reader (WB-A11Y-002)

With NVDA (Windows, free) or VoiceOver (macOS: Cmd+F5):

- [ ] Open the popup: the heading, status message and "Text to improve" box are announced.
- [ ] Tab through: every button has a clear name.
- [ ] Run Fix grammar: the result is announced, and changes read as "removed … added …".
- [ ] Replace on page: focus moves to "Yes, replace"; Escape cancels.

## 7. Appearance

- [ ] Popup looks right in Chrome's light and dark themes (Settings → Appearance → Mode).
- [ ] With a long text and results, the popup scrolls rather than cutting content off.
