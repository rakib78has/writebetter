import type { Page } from '@playwright/test';
import { expect, selectInField, test } from './fixtures.ts';

/**
 * Writing the corrected text back to the page, in real Chromium: the
 * execCommand path with native undo, which jsdom cannot run.
 */

const ENGINE_TIMEOUT = 20_000;
const ORIGINAL = 'Hi all, we was late and teh build failed.';
const CORRECTED = 'Hi all, we were late and the build failed.';

/** Selects the draft's errors, opens WriteBetter, and runs Fix grammar. */
async function fixDraft(page: Page, invokeExtensionOn: (page: Page) => Promise<Page>) {
  await selectInField(page, '#draft', 8, 41);
  const popup = await invokeExtensionOn(page);
  await popup.getByRole('button', { name: 'Fix grammar' }).click();
  await expect(popup.getByRole('button', { name: 'Replace on page' })).toBeVisible({
    timeout: ENGINE_TIMEOUT,
  });
  return popup;
}

async function confirmReplace(popup: Page) {
  await popup.getByRole('button', { name: 'Replace on page' }).click();
  await popup.getByRole('button', { name: 'Yes, replace' }).click();
}

// WB-E2E-019
test('replaces the selection after confirmation, as typing would', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  const popup = await fixDraft(page, invokeExtensionOn);
  const draft = page.locator('#draft');

  await popup.getByRole('button', { name: 'Replace on page' }).click();
  // Asking is not enough: the page is unchanged until the user confirms.
  await expect(draft).toHaveValue(ORIGINAL);
  await popup.getByRole('button', { name: 'Yes, replace' }).click();

  await expect(popup.getByText('Replaced on the page.')).toBeVisible();
  await expect(draft).toHaveValue(CORRECTED);
  // The browser's own editing command ran, so page scripts saw a normal edit.
  expect(
    await page.evaluate(() => (window as unknown as { draftEvents: string[] }).draftEvents)
  ).toEqual(['input:insertText', 'change']);
});

// WB-E2E-020
test('Ctrl+Z in the page undoes the replacement', async ({ openFixture, invokeExtensionOn }) => {
  const page = await openFixture('editors.html');
  const popup = await fixDraft(page, invokeExtensionOn);
  await confirmReplace(popup);
  await expect(page.locator('#draft')).toHaveValue(CORRECTED);

  await page.bringToFront();
  await page.locator('#draft').press('ControlOrMeta+z');

  await expect(page.locator('#draft')).toHaveValue(ORIGINAL);
});

// WB-E2E-021
test('the Undo button puts the original text back', async ({ openFixture, invokeExtensionOn }) => {
  const page = await openFixture('editors.html');
  const popup = await fixDraft(page, invokeExtensionOn);
  await confirmReplace(popup);
  await expect(page.locator('#draft')).toHaveValue(CORRECTED);

  await popup.getByRole('button', { name: 'Undo' }).click();

  await expect(popup.getByText('The original text is back on the page.')).toBeVisible();
  await expect(page.locator('#draft')).toHaveValue(ORIGINAL);
});

// WB-SEC-024
test('never overwrites text the user changed after opening WriteBetter', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  const popup = await fixDraft(page, invokeExtensionOn);

  // The user goes back and rewrites the sentence themselves.
  const rewritten = 'Hi all, sorry, the build broke because of me.';
  await page.locator('#draft').evaluate((field, value) => {
    const textarea = field as HTMLTextAreaElement;
    textarea.value = value;
    textarea.focus();
  }, rewritten);

  await confirmReplace(popup);

  await expect(popup.getByRole('alert')).toContainText('has changed since WriteBetter read it');
  await expect(page.locator('#draft')).toHaveValue(rewritten);
});

// WB-E2E-022
test('copies the corrected text, ready to paste anywhere', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  const popup = await fixDraft(page, invokeExtensionOn);

  await popup.getByRole('button', { name: 'Copy' }).click();
  await expect(popup.getByText('Copied to the clipboard.')).toBeVisible();

  // Checked the way a user would: by pasting into a text box on the page.
  // (Reading the clipboard from a test needs a permission Chrome won't grant
  // to extension pages.)
  await page.bringToFront();
  const subject = page.locator('#subject');
  await subject.fill('');
  await subject.press('ControlOrMeta+v');
  await expect(subject).toHaveValue('we were late and the build failed.');
});
