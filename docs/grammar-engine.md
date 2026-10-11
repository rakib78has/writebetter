# Grammar engine

WriteBetter's free "Fix grammar" runs entirely on the user's device using [Harper](https://github.com/automattic/harper), an open-source grammar checker written in Rust and compiled to WebAssembly. This document records why Harper was chosen, what was measured, and what it can't do.

## Options considered (October 2026)

| Option                                      | Local? | Grammar? | Verdict                                                                                                   |
| ------------------------------------------- | ------ | -------- | --------------------------------------------------------------------------------------------------------- |
| **Harper** (`harper.js` 2.10.0, Apache-2.0) | Yes    | Yes      | **Chosen.** Real grammar rules plus spelling, maintained (release Sept 2026), no network access.          |
| `nspell` + `dictionary-en` (MIT)            | Yes    | No       | Spelling only. Last release 2022.                                                                         |
| `write-good`, `retext-*` (MIT)              | Yes    | No       | Style hints ("passive voice", "weasel words"), not corrections.                                           |
| LanguageTool                                | No     | Yes      | Java server. Using it means sending text off the device, which breaks the free mode's privacy promise.    |
| Chrome built-in AI (Proofreader, Rewriter)  | Yes    | Yes      | Still in origin trial; needs a multi-GB model download and capable hardware. Revisit for rewrite actions. |

## Measurements

Measured on Windows 11 (developer laptop), Playwright's Chromium 1.64.

| Metric                                     | Result                             |
| ------------------------------------------ | ---------------------------------- |
| Engine startup (download + compile + init) | ~1.3 s in Chromium, ~1.7 s in Node |
| Checking 5,000 characters                  | ~60 ms                             |
| WebAssembly file                           | 15.6 MB (8.1 MB gzipped)           |
| Whole extension package (zip)              | 7.8 MB                             |
| Network requests while checking            | None (test WB-SEC-018)             |

Startup begins as soon as the popup opens, so by the time the user has read their text and clicked **Fix grammar**, it is usually done.

Harper ships a "full" and a "slim" build. They gave identical results on every test case, so WriteBetter uses the slim one. The build gate fails if more than one `.wasm` file is bundled.

## Accuracy

The regression suite (`tests/integration/grammar-accuracy.test.ts`, fixtures in `tests/fixtures/grammar-cases.json`) runs the real engine through the full pipeline. With harper.js 2.10.0:

- **Fixed correctly (17 cases):** their/they're, there/their, has/have, a/an, dont, typos (teh), we was, repeated words, could of / should of, its/it's, misspellings, go/goes, alot, day names, lowercase "i"; also inside text with emoji, accents and line breaks.
- **Missed (known):** "Your welcome" (your/you're), "John and I" as an object.
- **No false fixes** on clean business, casual and technical text, URLs, emails, @mentions, #tags, `code`, file names, identifiers and HTML.

This is a small, hand-picked set, not a benchmark. It proves specific behaviours and catches regressions when Harper is upgraded. It does not measure overall accuracy.

## WriteBetter's safeguards

Harper's raw output is filtered by `src/writing/safeguards.ts` before anything is changed:

1. **Non-prose is left alone.** Issues touching URLs, emails, @mentions, #tags, `code`, HTML tags, file names or identifiers are dropped. Without this, Harper turned `<img src=x>` into `<i mg sac=x>`.
2. **Names are never "corrected" automatically.** A spelling fix to a capitalised word is shown for review instead. Without this, "Rakib" became "Rabbi" and "Siobhan" became "Sideman".
3. **The first word is never capitalised automatically**, because selected text is often a fragment of a sentence. The lowercase pronoun "i" is the exception.
4. **Mistakes and matters of taste are kept apart.** Each suggestion is classified by the Harper _rule_ that made it (`organizedLints`), not just its broad kind, because a kind like `WordChoice` mixes real errors ("could of" → "could have") with advice ("very unique" → "very special"). Style suggestions go to **Polish style** and are never applied automatically. A suggestion counts as style if its rule is listed in `STYLE_RULES`, its kind is a style kind (Style, Readability, Redundancy, Formatting and so on), its rule name starts with `Expand` (initialisms), or its message reads as advice ("consider…", "try…").
5. **Rules that break correct English are switched off** (`DISABLED_RULES`). `Everyone` turned the correct "every one of the participants" into "everyone of".

Anything held back by these rules is listed under "possible problems to check yourself", so nothing is hidden.

## Polish style

Harper enables 873 of its 885 rules by default. Its style rules are narrow: on a sample of typically wordy sentences ("in order to", "due to the fact that", "at this point in time", "utilize"), none fired. Turning on the 12 rules that are off by default crashed the engine (one needs a thesaurus the slim build doesn't include). So Polish style offers what Harper reliably reports (absolute adjectives, initialisms, double spaces and similar) and says plainly when it has nothing. It is not a rewriting tool.

## Limitations

- **English only.** American, British, Australian, Canadian and Indian English are supported. The popup picks one from the browser's language (en-GB → British, and so on; American otherwise) and the user can change it. Spelling follows the choice: in American English "colour" is corrected to "color"; in British English the reverse.
- **Rule-based.** It catches common mechanical errors well and misses some others (see above). Polish style finds only a few kinds of style issue. Nothing here rephrases or changes tone.
- **Fragments.** When a selection starts mid-sentence with a word Harper wants to capitalise, Harper's own de-duplication can drop a second fix on that word ("their is…" is left for review rather than corrected to "there is…").
- **Size.** 16 MB on disk is large for an extension, though well within Chrome Web Store limits.

## How it runs

```
popup (React)                      grammar worker (bundled .js file)
  fixGrammar(text) ──postMessage──►  createRequestHandler
                                       Harper LocalLinter (WebAssembly)
  applySafeguards  ◄──postMessage──    checkWithHarper → Issue[]
  applyFixes
  → corrected text + issue lists
```

- Harper's own `WorkerLinter` starts its worker from a `blob:` URL, which the extension's Content Security Policy forbids. WriteBetter runs Harper's `LocalLinter` inside its own bundled worker instead.
- Compiling WebAssembly requires `'wasm-unsafe-eval'` in the CSP. Despite the name, it permits WebAssembly only; JavaScript `eval()` stays blocked.
- Messages in both directions are validated (`protocol.ts`). Error responses carry no message, so a failure can never echo the user's text.
- If the worker fails to load or stops responding, the request fails with a clear message, and the next attempt starts a fresh worker.

## Upgrading Harper

1. Bump `harper.js` (exact version) and run `npm test`.
2. If an accuracy case fails, look at the new output. If it is better (for example, a known miss is now caught), move the case and update `grammar-cases.json`. If it is worse, report it upstream or stay on the old version.
3. Check that `npm run validate:build` still finds one `.wasm` file within the size budget.
