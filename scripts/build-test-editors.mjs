#!/usr/bin/env node
/**
 * Builds the rich-text editor test pages (tests/fixtures/rich-editors) into
 * tests/fixtures/.built-editors, where the end-to-end tests serve them.
 *
 * The pages use the real ProseMirror, Quill, Lexical, Slate and TinyMCE
 * libraries, so
 * compatibility claims are tested against the editors themselves rather than
 * a plain contenteditable stand-in. These libraries are dev dependencies
 * only and are never part of the extension.
 */

import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '../tests/fixtures/rich-editors');
const EDITORS = ['prosemirror', 'quill', 'lexical', 'slate', 'tinymce'];

await build({
  root,
  configFile: false,
  // The Slate page is written in React (JSX).
  plugins: [react()],
  base: './',
  logLevel: 'warn',
  build: {
    outDir: resolve(root, '../.built-editors'),
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: Object.fromEntries(EDITORS.map((name) => [name, resolve(root, `${name}.html`)])),
    },
  },
});

console.log(`✔ Built editor test pages: ${EDITORS.join(', ')}`);
