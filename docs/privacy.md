# Privacy

This describes the extension as it is built today. It is updated whenever data handling changes.

## Current behavior (Milestone 1)

| Question                           | Answer                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| What text is processed?            | Only text you type or paste into the popup.                                  |
| Where is it processed?             | In the popup, on your device. It is used only to count words and characters. |
| Is anything sent over the network? | No. The extension makes no network requests.                                 |
| Is anything stored?                | No. Text is discarded when the popup closes.                                 |
| Can it read web pages?             | No. It has no permissions.                                                   |
| Analytics or telemetry?            | None.                                                                        |

## Commitments for later milestones

- Local processing stays the default. Text is never sent to a server unless you turn on a remote feature, which will be clearly labelled.
- Only the selected text is ever processed, never the rest of the page.
- Writing history is not stored by default. If it is added, it will be opt-in and deletable.
- Password fields are never read.
