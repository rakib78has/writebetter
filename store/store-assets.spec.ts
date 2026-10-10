import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, selectInField, test } from '../tests/e2e/fixtures.ts';

/**
 * Generates the Chrome Web Store images from the real, built extension, so
 * they always match what users get. Run with `npm run store:assets`.
 *
 * Web Store sizes: screenshots 1280×800, small promo tile 440×280.
 */

const OUT = resolve(import.meta.dirname, 'images');
const ENGINE_TIMEOUT = 20_000;

/** Lays a popup screenshot beside a caption on a 1280×800 canvas. */
async function compose(page: Page, popupPng: Buffer, title: string, body: string, file: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <style>
      body { margin: 0; width: 1280px; height: 800px; display: flex; align-items: center;
             gap: 64px; padding: 0 96px; box-sizing: border-box; font-family: system-ui, sans-serif;
             background: linear-gradient(135deg, #eef2ff, #e0e7ff); color: #1e1b4b; }
      .copy { flex: 1; } h1 { font-size: 48px; margin: 0 0 16px; } p { font-size: 24px; line-height: 1.4; margin: 0; color: #3730a3; }
      img { border-radius: 12px; box-shadow: 0 20px 50px rgb(30 27 75 / 0.25); max-height: 720px; }
    </style>
    <div class="copy"><h1>${title}</h1><p>${body}</p></div>
    <img src="data:image/png;base64,${popupPng.toString('base64')}">`);
  await page.screenshot({ path: `${OUT}/${file}` });
}

test('generate Chrome Web Store images', async ({ context, openFixture, invokeExtensionOn }) => {
  await mkdir(OUT, { recursive: true });

  const page = await openFixture('editors.html');
  await selectInField(page, '#draft', 0, 41);
  const popup = await invokeExtensionOn(page);
  await popup.setViewportSize({ width: 360, height: 760 });
  await popup.getByRole('button', { name: 'Fix grammar' }).click();
  await expect(popup.getByRole('button', { name: 'Replace on page' })).toBeVisible({
    timeout: ENGINE_TIMEOUT,
  });
  const results = await popup.locator('main').screenshot();

  await popup.getByRole('button', { name: 'Replace on page' }).click();
  const confirm = await popup.locator('main').screenshot();

  const canvas = await context.newPage();
  await compose(
    canvas,
    results,
    'Fix grammar without leaving the page',
    'Select text in a text box or editor, open WriteBetter, and see every correction before anything changes. Checking runs entirely on your device.',
    'screenshot-1-fix.png'
  );
  await compose(
    canvas,
    confirm,
    'You decide what changes',
    'Copy the result, or put it back on the page after you confirm. Formatting is kept, and Ctrl+Z undoes it.',
    'screenshot-2-replace.png'
  );

  // Small promo tile: icon and name only, as the store recommends.
  await canvas.setViewportSize({ width: 440, height: 280 });
  await canvas.setContent(`<!doctype html><meta charset="utf-8">
    <style>body { margin: 0; width: 440px; height: 280px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 16px; font-family: system-ui, sans-serif;
      background: linear-gradient(135deg, #6366f1, #4338ca); color: white; }
      h1 { margin: 0; font-size: 40px; } p { margin: 0; font-size: 18px; opacity: 0.9; }</style>
    <h1>WriteBetter</h1><p>Private grammar fixes, where you write</p>`);
  await canvas.screenshot({ path: `${OUT}/promo-small-440x280.png` });
});
