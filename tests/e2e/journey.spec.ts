import { expect, selectInField, test } from './fixtures.ts';

/**
 * The core user journey from the product brief, in one test, in the order a
 * user does it. Other specs cover each step's variations; this one proves
 * the steps work together.
 */

// WB-E2E-025
test('select, open, fix, review, copy, replace, undo', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  // 1–3. The user selects text in a supported field on a website.
  const page = await openFixture('editors.html');
  const draft = page.locator('#draft');
  await selectInField(page, '#draft', 8, 41);

  // 4. They open WriteBetter (toolbar icon, menu or shortcut).
  const popup = await invokeExtensionOn(page);
  await expect(popup.getByRole('status')).toHaveText('Loaded the text you selected.');
  await expect(popup.getByRole('textbox', { name: 'Text to improve' })).toHaveValue(
    'we was late and teh build failed.'
  );

  // 5–6. They choose an action and WriteBetter produces a revision.
  await popup.getByRole('button', { name: 'Fix grammar' }).click();
  await expect(popup.getByRole('heading', { name: 'Fixed 2 problems' })).toBeVisible({
    timeout: 20_000,
  });

  // 7. They review it: every change is visible, with the reason.
  await expect(popup.getByLabel('Changes')).toContainText('removed: was');
  await expect(popup.getByLabel('Changes')).toContainText('added: were');
  await popup.getByText('Why each change was made').click();
  await expect(popup.getByRole('list').first()).toContainText('teh');

  // 8a. They copy it…
  await popup.getByRole('button', { name: 'Copy' }).click();
  await expect(popup.getByText('Copied to the clipboard.')).toBeVisible();

  // 8b. …or replace it, which needs an explicit confirmation.
  await popup.getByRole('button', { name: 'Replace on page' }).click();
  await expect(draft).toHaveValue('Hi all, we was late and teh build failed.');
  await popup.getByRole('button', { name: 'Yes, replace' }).click();

  // 9. Success is confirmed, and the original can be restored.
  await expect(popup.getByText('Replaced on the page.')).toBeVisible();
  await expect(draft).toHaveValue('Hi all, we were late and the build failed.');
  await popup.getByRole('button', { name: 'Undo' }).click();
  await expect(draft).toHaveValue('Hi all, we was late and teh build failed.');
});
