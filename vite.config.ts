import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { buildManifest } from './manifest.config.ts';

const root = import.meta.dirname;
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version: string;
};

/** Writes the typed manifest into the build output as manifest.json. */
function emitManifest(): Plugin {
  return {
    name: 'writebetter:emit-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(buildManifest(version), null, 2)}\n`,
      });
    },
  };
}

/**
 * Builds the popup page and the background service worker.
 *
 * Content scripts arrive in Milestone 2. They will need a separate IIFE build,
 * because Chrome runs content scripts as classic scripts, not ES modules.
 */
export default defineConfig(({ mode }) => ({
  root: resolve(root, 'src'),
  publicDir: resolve(root, 'public'),
  base: './',
  plugins: [react(), tailwindcss(), emitManifest()],
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    target: 'chrome116',
    // Production builds are minified (React alone is ~1 MB unminified). The
    // Chrome Web Store allows minification but not obfuscation. Source maps
    // help local debugging and are left out of the store package.
    minify: mode === 'production',
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: resolve(root, 'src/popup/index.html'),
        'service-worker': resolve(root, 'src/background/service-worker.ts'),
      },
      output: {
        // The manifest names the worker by a fixed path, so it cannot be
        // hashed or nested like the other bundles.
        entryFileNames: (chunk) =>
          chunk.name === 'service-worker' ? 'service-worker.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
}));
