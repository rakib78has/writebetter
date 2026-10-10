/**
 * Web Worker entry point that runs Harper, a grammar checker compiled to
 * WebAssembly, off the popup's main thread.
 *
 * Harper ships its own WorkerLinter, but it builds its worker from a blob:
 * URL, which the extension's Content Security Policy forbids. Running
 * Harper's LocalLinter inside this bundled worker file gives the same
 * benefit and satisfies the policy.
 *
 * All text stays inside the browser: Harper makes no network requests; the
 * only fetch is the WebAssembly file, from the extension package itself.
 */
import { LocalLinter } from 'harper.js';
import { slimBinary } from 'harper.js/slimBinary';
import { createRequestHandler } from './worker-handler.ts';

const handle = createRequestHandler(new LocalLinter({ binary: slimBinary }));

self.addEventListener('message', (event: MessageEvent) => {
  void handle(event.data).then((response) => {
    if (response) self.postMessage(response);
  });
});
