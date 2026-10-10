import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { App } from './App.tsx';
import { loadSelection } from './selection-source.ts';

const container = document.getElementById('root');
if (!container) throw new Error('Popup root element #root is missing from index.html');

// Defined once, outside React, so the effect that calls it runs once per
// popup opening rather than on every render.
const loadFromPage = () => loadSelection(chrome, window.location.search);

createRoot(container).render(
  <StrictMode>
    <App loadSelection={loadFromPage} />
  </StrictMode>
);
