import { expect, OTHER_FIXTURE_ORIGIN, selectInField, test } from './fixtures.ts';

/**
 * Reading the user's selection from a real page in real Chromium.
 *
 * Each test invokes the extension the way a user does (which grants
 * activeTab), then checks what the popup shows.
 */

const textbox = { name: 'Text to improve' } as const;

// WB-E2E-006
test('loads text selected in a textarea', async ({ openFixture, invokeExtensionOn }) => {
  const page = await openFixture('editors.html');
  // "their is a problem"
  await selectInField(page, '#message', 11, 29);

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toHaveText('Loaded the text you selected.');
  await expect(popup.getByRole('textbox', textbox)).toHaveValue('their is a problem');
  await expect(popup.getByText('4 words · 18 / 5,000 characters')).toBeVisible();
});

// WB-E2E-007
test('loads text selected in a text input', async ({ openFixture, invokeExtensionOn }) => {
  const page = await openFixture('editors.html');
  await selectInField(page, '#subject', 0, 14);

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('textbox', textbox)).toHaveValue('Quick question');
});

// WB-E2E-008
test('asks for a selection when the caret is in a field with nothing selected', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  await selectInField(page, '#message', 5, 5);

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toContainText('No text is selected');
  await expect(popup.getByRole('textbox', textbox)).toHaveValue('');
});

// WB-E2E-009
test('explains what to do when no text field has focus', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toContainText('Select text in a text box');
});

// WB-SEC-010
test('never loads text from a password field', async ({ openFixture, invokeExtensionOn }) => {
  const page = await openFixture('editors.html');
  await selectInField(page, '#password', 0, 14);

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toContainText('never reads password');
  await expect(popup.getByRole('textbox', textbox)).toHaveValue('');
  await expect(popup.getByText('hunter2-secret')).toHaveCount(0);
});

// WB-SEC-011
test('never loads text from a one-time-code field', async ({ openFixture, invokeExtensionOn }) => {
  const page = await openFixture('editors.html');
  await selectInField(page, '#otp', 0, 6);

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toContainText('never reads password');
  await expect(popup.getByRole('textbox', textbox)).toHaveValue('');
});

// WB-E2E-010
test('loads a read-only selection and says it cannot be changed', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  await selectInField(page, '#readonly', 0, 9);

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toContainText('read-only');
  await expect(popup.getByRole('textbox', textbox)).toHaveValue('This note');
});

// WB-E2E-011
test('offers paste as a fallback in a rich-text editor', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  await page.locator('#rich').focus();

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toContainText('editor isn’t supported yet');
  await expect(popup.getByRole('status')).toContainText('paste it below');
});

// WB-E2E-012
test('reports an email field as unsupported', async ({ openFixture, invokeExtensionOn }) => {
  const page = await openFixture('editors.html');
  await page.locator('#email').focus();

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toContainText('field isn’t supported');
});

// WB-SEC-012
test('cannot read a page the user has not invoked the extension on', async ({
  openFixture,
  openPopupWithoutAccess,
}) => {
  const page = await openFixture('editors.html');
  await selectInField(page, '#message', 0, 4);

  const popup = await openPopupWithoutAccess(page);

  await expect(popup.getByRole('status')).toContainText('can’t read this page');
  await expect(popup.getByRole('textbox', textbox)).toHaveValue('');
});

// WB-E2E-013
test('explains that browser pages are off-limits', async ({ context, invokeExtensionOn }) => {
  const page = await context.newPage();
  await page.goto('chrome://version');

  const popup = await invokeExtensionOn(page);

  await expect(popup.getByRole('status')).toContainText('can’t read this page');
});

// WB-E2E-014
test('loses access once the tab moves to another site', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  const first = await invokeExtensionOn(page);
  await expect(first.getByRole('status')).toContainText('Select text in a text box');

  // Chrome revokes activeTab when the tab navigates to a different origin.
  // Reading again afterwards, without a new click, must fail.
  await page.goto(`${OTHER_FIXTURE_ORIGIN}/editors.html`);
  await selectInField(page, '#message', 0, 4);
  const second = await first.context().newPage();
  await second.goto(first.url()); // same popup URL, so the same tab id

  await expect(second.getByRole('status')).toContainText('can’t read this page');
});

// WB-E2E-016
test('keeps access across a navigation within the same site', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  const first = await invokeExtensionOn(page);
  await expect(first.getByRole('status')).toContainText('Select text in a text box');

  // Chromium keeps the activeTab grant for same-origin navigations. This
  // pins that behaviour down, because docs/privacy.md describes it.
  await page.goto('https://fixture.test/editors.html?next');
  await selectInField(page, '#message', 0, 4);
  const second = await first.context().newPage();
  await second.goto(first.url());

  await expect(second.getByRole('textbox', textbox)).toHaveValue('Dear');
});

// WB-E2E-015
test('the service worker can open the popup, as the context menu does', async ({
  context,
  openFixture,
  serviceWorker,
}) => {
  // Chrome's native right-click menu cannot be clicked from a test. This
  // checks the step the menu handler relies on: openPopup() works in this
  // Chromium. The handler itself is covered by tests/integration.
  await openFixture('editors.html');
  const browser = context.browser();
  if (!browser) throw new Error('Expected a browser handle');
  const cdp = await browser.newBrowserCDPSession();

  await serviceWorker.evaluate(() => chrome.action.openPopup());

  await expect
    .poll(async () => {
      const { targetInfos } = await cdp.send('Target.getTargets');
      return targetInfos.some((info) => info.url.endsWith('/popup/index.html'));
    })
    .toBe(true);
  await cdp.detach();
});
