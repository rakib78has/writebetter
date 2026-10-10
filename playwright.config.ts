import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against the built extension (dist/) in real Chromium.
 *
 * An extension cannot be loaded into Playwright's default browser. It needs a
 * persistent context launched with --load-extension, which the fixtures in
 * tests/e2e/fixtures.ts set up, so specs import from there instead of from
 * '@playwright/test' directly. Run `npm run build` before these tests.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Each test launches its own browser profile, so this is about keeping
  // Chromium resource use predictable rather than avoiding shared state.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
