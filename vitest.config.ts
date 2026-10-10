import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Pure logic: runs in Node, with no browser or DOM.
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // Code that touches the DOM, including React components, run in
        // jsdom (a simulated DOM).
        plugins: [react()],
        test: {
          name: 'component',
          include: ['tests/component/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/helpers/setup-component.ts'],
        },
      },
      {
        // Chrome-facing modules wired to a fake Chrome API.
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      // Thin entry points that only wire real Chrome APIs together. The
      // end-to-end suite exercises them in a real browser.
      exclude: ['src/popup/main.tsx', 'src/background/service-worker.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
