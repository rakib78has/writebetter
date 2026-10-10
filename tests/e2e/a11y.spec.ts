import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, extensionUrl, selectInField, test } from './fixtures.ts';

/**
 * Automated accessibility scans of the popup with axe-core, against WCAG 2.1
 * A and AA, in each state a user can reach, in light and dark mode.
 *
 * Automated checks find roughly a third to a half of accessibility problems
 * (missing names, contrast, ARIA misuse). Keyboard flow is covered by the
 * component tests; a screen-reader pass remains a manual check.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const ENGINE_TIMEOUT = 20_000;

async function expectNoViolations(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact ?? 'n/a'}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
  );
  expect(summary, `Accessibility violations in state "${state}"`).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    // WB-A11Y-001
    test('popup states have no WCAG A/AA violations', async ({
      context,
      extensionId,
      openFixture,
      invokeExtensionOn,
    }) => {
      // Typed text, then over the limit.
      const typed = await context.newPage();
      await typed.emulateMedia({ colorScheme: scheme });
      await typed.goto(extensionUrl(extensionId, 'popup/index.html'));
      await expect(typed.getByRole('status')).toContainText('can’t read this page');
      await expectNoViolations(typed, 'opened with no page access');
      await typed.getByRole('textbox', { name: 'Text to improve' }).fill('x'.repeat(5001));
      await expectNoViolations(typed, 'text over the limit');

      // Loaded from the page, fixed, confirming a replacement.
      const page = await openFixture('editors.html');
      await selectInField(page, '#draft', 8, 41);
      const popup = await invokeExtensionOn(page);
      await popup.emulateMedia({ colorScheme: scheme });
      await expect(popup.getByRole('status')).toHaveText('Loaded the text you selected.');
      await expectNoViolations(popup, 'selection loaded');

      await popup.getByRole('button', { name: 'Fix grammar' }).click();
      await expect(popup.getByRole('button', { name: 'Replace on page' })).toBeVisible({
        timeout: ENGINE_TIMEOUT,
      });
      await popup.getByText('Why each change was made').click();
      await expectNoViolations(popup, 'results with explanations open');

      await popup.getByRole('button', { name: 'Replace on page' }).click();
      await expectNoViolations(popup, 'confirming a replacement');

      await popup.getByRole('button', { name: 'Yes, replace' }).click();
      await expect(popup.getByText('Replaced on the page.')).toBeVisible();
      await expectNoViolations(popup, 'replaced');
    });
  });
}
