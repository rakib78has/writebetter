import { expect, extensionUrl, test } from './fixtures.ts';

/**
 * Smoke suite: proves the built dist/ is an extension Chromium will load.
 *
 * Every later end-to-end test depends on this. When it fails, the cause is
 * usually a broken build or a manifest path that no longer matches the
 * output, not a feature bug.
 */

// WB-E2E-001
test('loads the extension and starts its service worker', ({ serviceWorker, extensionId }) => {
  expect(serviceWorker.url()).toBe(extensionUrl(extensionId, 'service-worker.js'));
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

// WB-E2E-002
test('opens the popup and updates counts as the user types', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(extensionUrl(extensionId, 'popup/index.html'));

  await expect(page.getByRole('heading', { name: 'WriteBetter' })).toBeVisible();
  // Opened directly, the popup's "active tab" is itself, which Chrome does
  // not let an extension script. It must say so rather than fail silently.
  await expect(page.getByRole('status')).toContainText('can’t read this page');

  const textbox = page.getByRole('textbox', { name: 'Text to improve' });
  await textbox.fill('Their going to the park 👋🏽');
  await expect(page.getByText('5 words · 25 / 5,000 characters')).toBeVisible();
});

// WB-E2E-003
test('applies the stylesheet', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(extensionUrl(extensionId, 'popup/index.html'));

  // The popup's root sets a fixed 360px width through Tailwind. If the CSS
  // bundle failed to load, the element would stretch to the window instead.
  const width = await page.getByRole('main').evaluate((element) => element.clientWidth);
  expect(width).toBe(360);
});

// WB-E2E-004
test('popup loads with no errors or CSP violations', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });

  await page.goto(extensionUrl(extensionId, 'popup/index.html'));
  await expect(page.getByRole('heading', { name: 'WriteBetter' })).toBeVisible();

  expect(problems).toEqual([]);
});
