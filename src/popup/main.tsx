import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { createWorkerGrammarChecker } from '../writing/local/worker-checker.ts';
import { App } from './App.tsx';
import { loadSelection } from './selection-source.ts';

const container = document.getElementById('root');
if (!container) throw new Error('Popup root element #root is missing from index.html');

// Defined once, outside React, so the effect that calls it runs once per
// popup opening rather than on every render.
const loadFromPage = () => loadSelection(chrome, window.location.search);

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
    <App loadSelection={loadFromPage} grammar={grammar} />
  </StrictMode>
);
