# Architecture

This document describes what is built today and the planned shape it is growing into. Planned parts are marked **(planned)**.

## Extension contexts

A Chrome extension is not one program. It is several separate JavaScript environments that cannot share memory and can only exchange messages:

| Context             | Where it runs                                              | Lifetime                           | WriteBetter's use                                                                   |
| ------------------- | ---------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| **Popup**           | Its own page, when the icon is clicked                     | Destroyed the moment it closes     | The main interface. Built with React.                                               |
| **Service worker**  | Background, no DOM                                         | Stopped by Chrome after ~30 s idle | Registers the context menu and opens the popup when it is used.                     |
| **Injected script** | Inside a web page, isolated from the page's own JavaScript | One call, then gone                | `captureSelection()` reads the selection. Replacing text comes later **(planned)**. |

Two consequences shape the design:

- **Nothing survives in memory.** Because the popup and the worker can disappear at any time, state that must persist goes in `chrome.storage`, never in a variable.
- **Everything from a page is untrusted input.** The page controls the DOM the capture function reads, so its result is validated by `parseCaptureResult()` before the popup uses it.

## Current layout

```
manifest.config.ts         Typed manifest; version comes from package.json
vite.config.ts             Builds popup + worker; emits manifest.json
src/
  popup/
    App.tsx                React UI; receives loadSelection() as a prop
    main.tsx               Mounts App with the real Chrome-backed loader
    selection-source.ts    Finds the tab, injects captureSelection, validates the result
    selection-message.ts   Turns each outcome into a message for the user
  background/
    service-worker.ts      Registers listeners at startup
    context-menu.ts        Menu registration and click handling
  content/
    capture-selection.ts   Self-contained function injected into the page
  writing/                The writing engine. Knows nothing about Chrome or the UI
    types.ts               Issue, GrammarChecker, GrammarCheckError
    fix-grammar.ts         The "Fix grammar" action: check → safeguards → apply
    safeguards.ts          Never touch URLs/code/names; no auto-capitalised fragments
    apply-fixes.ts         Applies the safe fixes to produce the corrected text
    local/                 Harper, the on-device engine
      grammar.worker.ts    Worker entry point
      worker-handler.ts    Worker logic (testable without a worker)
      worker-checker.ts    Popup side: GrammarChecker over postMessage, timeouts
      protocol.ts          Validated message types between the two
      harper-issues.ts     The only file that knows Harper's types
  popup/components/       GrammarResults.tsx
  shared/                  Logic with no Chrome or DOM dependency
    capture.ts             CaptureResult type and parseCaptureResult() validator
    constants.ts           MAX_INPUT_CHARACTERS
    text-stats.ts          Unicode-aware word and character counts
  styles/global.css        Tailwind entry point
assets/icon.svg            Icon source; scripts/generate-icons.mjs renders PNGs
public/icons/              Rendered PNG icons, copied into dist/
scripts/                   validate-build, package, generate-icons
tests/                     unit/, component/, integration/, e2e/, fixtures/, helpers/
```

Folders from the target structure (`messaging/`, `storage/`, `writing/remote/`) are created when the milestone that needs them begins, not before. Empty folders would document intentions as if they were code.

## Reading the selection (Milestone 2)

```
user selects text in a field
        │
user clicks the icon ─┬─ or presses Alt+Shift+W  (Chrome opens the popup)
                      └─ or right-clicks → "Improve with WriteBetter"
                            (service worker calls chrome.action.openPopup())
        │   any of these grants activeTab for that tab
        ▼
popup opens → loadSelection()
        │   chrome.scripting.executeScript({ func: captureSelection })
        ▼
captureSelection() runs in the page's main frame
        │   reads only value.slice(selectionStart, selectionEnd)
        │   refuses password / one-time-code / card fields unread
        ▼
popup: parseCaptureResult() → describeSelection() → fill the text box
```

There is no long-lived content script and no runtime messaging yet: `executeScript` returns the function's result directly to the popup. That is the smallest design that works, and it means none of WriteBetter's code runs in a page until the user asks.

## Fixing grammar (Milestone 3)

See [grammar-engine.md](grammar-engine.md) for the engine choice, measurements and limits. In short: the popup starts a Web Worker as soon as it opens; the worker loads Harper (WebAssembly); "Fix grammar" sends the text, gets `Issue[]` back, applies WriteBetter's safeguards, then applies the safe fixes. The popup depends only on the `GrammarChecker` interface, so a remote AI engine can be added beside Harper later without UI changes.

## Planned data flow

```
user selects text ──► content script captures text + selection range
                            │
             popup / context menu requests it (validated message)
                            │
                  WritingEngine.process(action, text)
                   ├── LocalEngine  (default; text never leaves the device)
                   └── RemoteEngine (opt-in; secure backend only)  (Milestone 9)
                            │
             popup shows original vs revised ──► user clicks Copy or Replace
                            │
     content script checks the field is unchanged, then replaces the text
```

The writing engine will be a TypeScript interface, so the popup does not know or care whether a result came from local code or a server. That keeps the free, private, local mode the default, and lets a paid AI mode slot in later without rewriting the UI.

## Decisions

### D1. Typed manifest emitted by a small Vite plugin, not CRXJS

`@crxjs/vite-plugin` can generate the manifest and supports content-script hot reload, but it is a large dependency with a history of long maintenance gaps, and it hides how the extension is assembled. A 15-line plugin in `vite.config.ts` gives a type-checked manifest with the version read from `package.json`. Trade-off: no hot reload. After `npm run dev` rebuilds, you reload the extension manually.

### D2. React + Tailwind for the popup

As specified. React's rendering escapes text by default, which matters because user text is untrusted. Tailwind ships only the classes actually used (7 KB of CSS today).

### D3. Shared logic is plain TypeScript with no Chrome dependency

`src/shared/` can be tested in Node in milliseconds without a browser. The goal is to keep as much logic as possible there and keep the Chrome-facing code thin.

### D4. TypeScript 6.0, not 7

TypeScript 7 (the native port) is current, but `typescript-eslint` 8 supports only versions below 6.1. Type-aware linting was judged more valuable than the faster compiler for now.

### D5. No `eslint-plugin-jsx-a11y`

It does not yet support ESLint 10. Accessibility is checked instead by component tests that query by role and accessible name (the way assistive technology finds elements). Revisit when the plugin supports ESLint 10.

### D6. On-demand injection instead of a declared content script

See [security.md](security.md#why-not-a-content-script-on-every-page). In short: no install warning, no standing access, and nothing runs on a page until the user asks. The injected function has to be self-contained, because Chrome sends its source text to the page. The end-to-end suite runs the minified production build, which catches any bundler change that breaks that.

### D7. The context menu opens the popup rather than its own UI

The right-click entry calls `chrome.action.openPopup()`, available to all extensions from Chrome 127 (hence `minimum_chrome_version`). One UI serves all three entry points, and the menu click grants `activeTab` just as the icon does, so the popup reads the selection the same way whichever entry point was used.

### D8. Chrome APIs are passed in, not read from the global

`loadSelection(api, …)` and the context-menu functions take the slice of `chrome` they use as a parameter, and tests pass a small fake. This avoids global mocks that leak between tests, and the type (`Pick<typeof chrome.tabs, 'query'>`) documents exactly which APIs each module touches.

### D9. Harper for local grammar

See [grammar-engine.md](grammar-engine.md#options-considered-october-2026). It was the only option that does real grammar, runs locally and is actively maintained. The cost is 16 MB and English only.

### D10. Harper behind an interface, in our own worker

Only `harper-issues.ts` imports Harper's types; everything else uses `Issue` and `GrammarChecker`. Harper runs in a Web Worker so the 1–2 s startup and each check never freeze the popup. Harper's own worker helper is unusable under the extension's CSP (it uses a `blob:` URL), so the worker is a bundled file of ours.

### D11. Safeguards outside the engine

Rules about what may be changed automatically (`safeguards.ts`) live outside the engine adapter, so they will apply equally to a future remote engine. They were each added because a test showed the engine doing something harmful: changing names, mangling HTML, capitalising fragments.
