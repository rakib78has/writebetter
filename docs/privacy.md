# Privacy

This describes the extension as it is built today. It is updated whenever data handling changes.

## Current behavior (Milestone 3)

| Question                           | Answer                                                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When does WriteBetter read a page? | Only when you click its icon, choose **Improve with WriteBetter** from the right-click menu, or press its shortcut. Never in the background.                    |
| What does it read?                 | Only the text you selected in the focused text box. Not the rest of the box, not the rest of the page, not the page address.                                    |
| What does it never read?           | Password fields, verification-code fields and payment-card fields. They are recognised from their attributes, and their contents are never touched.             |
| Where is the text processed?       | On your device. Grammar is checked by Harper, a grammar engine bundled inside the extension and run in the browser. Nothing is sent anywhere (test WB-SEC-018). |
| Is anything sent over the network? | No. The extension makes no network requests.                                                                                                                    |
| Is anything stored?                | No. The text is discarded when the popup closes.                                                                                                                |
| Analytics or telemetry?            | None.                                                                                                                                                           |

### How long access to a tab lasts

Invoking WriteBetter lets it read that one tab until the tab goes to a different website or is closed. This is how Chrome's `activeTab` permission works. WriteBetter only reads during that time when you open it again.

## Commitments for later milestones

- Local processing stays the default. Text is never sent to a server unless you turn on a remote feature, which will be clearly labelled.
- Only the selected text is ever processed, never the rest of the page.
- Writing history is not stored by default. If it is added, it will be opt-in and deletable.
- Password, code and payment fields are never read.
