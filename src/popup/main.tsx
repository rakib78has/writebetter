import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { App } from './App.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('Popup root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
