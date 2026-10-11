import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import type { ReplaceRequest } from '../shared/replace.ts';
import { createWorkerGrammarChecker } from '../writing/local/worker-checker.ts';
import { loadSettings, saveSettings } from '../settings/settings.ts';
import { App } from './App.tsx';
import { loadSelection, replaceOnPage } from './page-access.ts';

const container = document.getElementById('root');
if (!container) throw new Error('Popup root element #root is missing from index.html');

// Defined once, outside React, so the effect that calls it runs once per
// popup opening rather than on every render.
const loadFromPage = () => loadSelection(chrome, window.location.search);
const replaceText = (request: ReplaceRequest) =>
  replaceOnPage(chrome, window.location.search, request);
const copyText = (text: string) => navigator.clipboard.writeText(text);
const settings = {
  load: () => loadSettings(chrome.storage.local, navigator.languages),
  save: (value: Parameters<typeof saveSettings>[1]) => saveSettings(chrome.storage.local, value),
};

// The `new URL(..., import.meta.url)` form is what tells Vite to bundle the
// worker as its own file.
const grammar = createWorkerGrammarChecker(
  () =>
    new Worker(new URL('../writing/local/grammar.worker.ts', import.meta.url), {
      type: 'module',
    })
);
// Start loading the engine now, so it is usually ready by the time the user
// clicks "Fix grammar". A failure here is not reported: the click retries
// and reports it then.
grammar.prepare().catch(() => undefined);

createRoot(container).render(
  <StrictMode>
    <App
      loadSelection={loadFromPage}
      grammar={grammar}
      replaceText={replaceText}
      copyText={copyText}
      settings={settings}
    />
  </StrictMode>
);
