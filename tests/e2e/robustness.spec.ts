import { expect, extensionUrl, OTHER_FIXTURE_ORIGIN, selectInField, test } from './fixtures.ts';

/**
 * Things going wrong: repeated actions, pages that change underneath the
 * popup, and editing surfaces WriteBetter can't use.
 */

const ENGINE_TIMEOUT = 20_000;

// WB-E2E-026
test('repeated Fix grammar clicks give one result for the latest text', async ({
  context,
  extensionId,
}) => {
  const popup = await context.newPage();
  await popup.goto(extensionUrl(extensionId, 'popup/index.html'));
  const input = popup.getByRole('textbox', { name: 'Text to improve' });
  const fix = popup.getByRole('button', { name: 'Fix grammar' });

  await input.fill('I has a apple.');
  // An impatient double click must not produce duplicate results. (The
  // button is disabled while checking; WB-UI-014 tests that state directly,
  // since a warm engine finishes too fast to observe it here.)
  await fix.dblclick();
  await expect(popup.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
    'I have an apple.',
    { timeout: ENGINE_TIMEOUT }
  );
  await expect(popup.getByRole('heading', { name: /^Fixed/ })).toHaveCount(1);

  // Editing clears the old result; checking again reflects the new text.
  await input.fill('This is teh plan.');
  await expect(popup.getByRole('textbox', { name: 'Corrected text' })).toHaveCount(0);
  await fix.click();
  await expect(popup.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
    'This is the plan.'
  );
  await expect(popup.getByRole('heading', { name: /^Fixed/ })).toHaveCount(1);
});

// WB-E2E-027
test('a text box removed from the page is reported, not written to', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  await selectInField(page, '#draft', 8, 41);
  const popup = await invokeExtensionOn(page);
  await popup.getByRole('button', { name: 'Fix grammar' }).click();
  await expect(popup.getByRole('button', { name: 'Replace on page' })).toBeVisible({
    timeout: ENGINE_TIMEOUT,
  });

  // The site re-renders and the text box disappears.
  await page.locator('#draft').evaluate((element) => {
    element.remove();
  });
  await popup.getByRole('button', { name: 'Replace on page' }).click();
  await popup.getByRole('button', { name: 'Yes, replace' }).click();

  await expect(popup.getByRole('alert')).toContainText('no longer selected');
  // The corrected text is still there to copy.
  await expect(popup.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
    'we were late and the build failed.'
  );
});

// WB-E2E-028
test('replacing after the tab moved to another site fails safely', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  await selectInField(page, '#draft', 8, 41);
  const popup = await invokeExtensionOn(page);
  await popup.getByRole('button', { name: 'Fix grammar' }).click();
  await expect(popup.getByRole('button', { name: 'Replace on page' })).toBeVisible({
    timeout: ENGINE_TIMEOUT,
  });

  await page.goto(`${OTHER_FIXTURE_ORIGIN}/editors.html`);
  await popup.getByRole('button', { name: 'Replace on page' }).click();
  await popup.getByRole('button', { name: 'Yes, replace' }).click();

  await expect(popup.getByRole('alert')).toContainText('can no longer reach that page');
  // The new page is untouched.
  await expect(page.locator('#draft')).toHaveValue('Hi all, we was late and teh build failed.');
});

// WB-E2E-029
test('a text box inside an embedded frame gets a clear fallback', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  await page.frameLocator('#frame').locator('#inner').focus();

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toContainText('embedded frames aren’t supported');
  await expect(popup.getByRole('status')).toContainText('paste it below');
  // The fallback works: pasted text can still be fixed.
  await popup.getByRole('textbox', { name: 'Text to improve' }).fill('teh embedded text');
  await popup.getByRole('button', { name: 'Fix grammar' }).click();
  await expect(popup.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
    'the embedded text',
    { timeout: ENGINE_TIMEOUT }
  );
});
