import { defineConfig } from '@playwright/test';

/** Generates the Chrome Web Store images. Not part of the test suite. */
export default defineConfig({
  testDir: '.',
  testMatch: 'store-assets.spec.ts',
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
});
