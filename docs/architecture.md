# Architecture

This document describes what is built today and the planned shape it is growing into. Planned parts are marked **(planned)**.

## Extension contexts

A Chrome extension is not one program. It is several separate JavaScript environments that cannot share memory and can only exchange messages:

| Context            | Where it runs                                              | Lifetime                           | WriteBetter's use                                                               |
| ------------------ | ---------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| **Popup**          | Its own page, when the icon is clicked                     | Destroyed the moment it closes     | The main interface. Built with React.                                           |
| **Service worker** | Background, no DOM                                         | Stopped by Chrome after ~30 s idle | Context menu, keyboard command, message routing. Currently empty. **(planned)** |
| **Content script** | Inside a web page, isolated from the page's own JavaScript | As long as the tab                 | Reads the selection and replaces text after confirmation. **(planned)**         |

Two consequences shape the design:

- **Nothing survives in memory.** Because the popup and the worker can disappear at any time, state that must persist goes in `chrome.storage`, never in a variable.
- **Every message is untrusted input.** Messages crossing contexts will be validated against typed contracts before use **(planned, `src/messaging/`)**.

## Current layout

```
manifest.config.ts         Typed manifest; version comes from package.json
vite.config.ts             Builds popup + worker; emits manifest.json
src/
  popup/                   React UI (index.html, main.tsx, App.tsx)
  background/              Service worker (empty in Milestone 1)
  shared/                  Logic with no Chrome or DOM dependency
    constants.ts           MAX_INPUT_CHARACTERS
    text-stats.ts          Unicode-aware word and character counts
  styles/global.css        Tailwind entry point
assets/icon.svg            Icon source; scripts/generate-icons.mjs renders PNGs
public/icons/              Rendered PNG icons, copied into dist/
scripts/                   validate-build, package, generate-icons
tests/                     unit/, component/, e2e/, helpers/
```

Folders from the target structure (`content/`, `writing/`, `messaging/`, `storage/`) are created when the milestone that needs them begins, not before. Empty folders would document intentions as if they were code.

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
