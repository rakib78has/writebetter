import { expect, extensionUrl, selectInField, test } from './fixtures.ts';

/**
 * "Fix grammar" with the real Harper engine, inside the built extension.
 * These prove what no other layer can: the worker and its WebAssembly are
 * bundled correctly and allowed to run under the extension's CSP.
 */

// Loading and compiling 16 MB of WebAssembly takes 1–2 s on a developer
// machine and can be slower on a shared CI runner.
const ENGINE_TIMEOUT = 20_000;

// WB-E2E-017
test('fixes grammar in typed text with the real engine', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(extensionUrl(extensionId, 'popup/index.html'));

  await popup.getByRole('textbox', { name: 'Text to improve' }).fill('I has a apple.');
  await popup.getByRole('button', { name: 'Fix grammar' }).click();

  await expect(popup.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
    'I have an apple.',
    { timeout: ENGINE_TIMEOUT }
  );
  await expect(popup.getByRole('heading', { name: 'Fixed 2 problems' })).toBeVisible();
});

// WB-E2E-018
test('the whole journey: select on a page, open WriteBetter, fix grammar', async ({
  openFixture,
  invokeExtensionOn,
}) => {
  const page = await openFixture('editors.html');
  // "we was late and teh build failed." - a fragment, starting lowercase.
  await selectInField(page, '#draft', 8, 41);

  const popup = await invokeExtensionOn(page);
  await expect(popup.getByRole('textbox', { name: 'Text to improve' })).toHaveValue(
    'we was late and teh build failed.'
  );
  await popup.getByRole('button', { name: 'Fix grammar' }).click();

  await expect(popup.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
    // The fragment's first word stays lowercase (see applySafeguards).
    'we were late and the build failed.',
    { timeout: ENGINE_TIMEOUT }
  );
  // The page itself is never changed: replacing text comes in a later
  // milestone, and only after the user confirms it.
  await expect(page.locator('#draft')).toHaveValue('Hi all, we was late and teh build failed.');
});

// WB-SEC-018
test('checking text makes no network request and logs no errors', async ({
  context,
  extensionId,
}) => {
  const requests: string[] = [];
  context.on('request', (request) => requests.push(request.url()));
  const popup = await context.newPage();
  const problems: string[] = [];
  popup.on('pageerror', (error) => problems.push(error.message));
  popup.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });

  await popup.goto(extensionUrl(extensionId, 'popup/index.html'));
  await popup.getByRole('textbox', { name: 'Text to improve' }).fill('This is teh secret plan.');
  await popup.getByRole('button', { name: 'Fix grammar' }).click();
  await expect(popup.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
    'This is the secret plan.',
    { timeout: ENGINE_TIMEOUT }
  );

  // Everything loaded came from the extension package itself.
  const external = requests.filter((url) => !url.startsWith(`chrome-extension://${extensionId}/`));
  expect(external).toEqual([]);
  expect(problems).toEqual([]);
});
