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
        // React components rendered into jsdom, a simulated DOM.
        plugins: [react()],
        test: {
          name: 'component',
          include: ['tests/component/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/helpers/setup-component.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/shared/**/*.ts', 'src/popup/**/*.tsx'],
      exclude: ['src/popup/main.tsx'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
