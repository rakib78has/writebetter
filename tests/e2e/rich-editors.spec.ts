import type { Page } from '@playwright/test';
import '../fixtures/rich-editors/shared.ts';
import { expect, selectInEditor, test } from './fixtures.ts';

/**
 * Fix grammar and replace in rich-text editors, against the real editor
 * libraries (built by scripts/build-test-editors.mjs) and a plain
 * contenteditable like Gmail's compose box.
 *
 * Each editor starts with the same content: "Hi all, we <b>was late</b> and
 * <a>teh build</a> failed." then "Thanks for your patience." (Lexical's page
 * has no link). The selection covers "we … failed.", so the two fixes fall
 * inside bold text and inside a link.
 */

const ENGINE_TIMEOUT = 20_000;
const ORIGINAL = 'Hi all, we was late and teh build failed.\nThanks for your patience.';
const FIXED = 'Hi all, we were late and the build failed.\nThanks for your patience.';

interface EditorCase {
  name: string;
  page: string;
  /** The contenteditable element. */
  editable: string;
  hasLink: boolean;
  /** The text as the editor itself holds it, paragraphs joined by "\n". */
  read: (page: Page) => Promise<string>;
}

const readModel = (page: Page) => page.evaluate(() => window.editorText());

const EDITORS: EditorCase[] = [
  {
    name: 'plain contenteditable (Gmail-style)',
    page: 'editors.html',
    editable: '#rich',
    hasLink: true,
    // Whitespace collapsed as displayed: the fixture's HTML is indented.
    read: (page) =>
      page.$$eval('#rich p', (paragraphs) =>
        paragraphs.map((p) => p.textContent.replace(/\s+/g, ' ').trim()).join('\n')
      ),
  },
  {
    name: 'ProseMirror',
    page: 'editors/prosemirror.html',
    editable: '.ProseMirror',
    hasLink: true,
    read: readModel,
  },
  {
    name: 'Quill',
    page: 'editors/quill.html',
    editable: '.ql-editor',
    hasLink: true,
    read: readModel,
  },
  {
    name: 'Lexical',
    page: 'editors/lexical.html',
    editable: '#editor',
    hasLink: false,
    read: readModel,
  },
];

for (const editor of EDITORS) {
  test.describe(editor.name, () => {
    async function openAndFix({
      openFixture,
      invokeExtensionOn,
    }: {
      openFixture: (name: string) => Promise<Page>;
      invokeExtensionOn: (page: Page) => Promise<Page>;
    }) {
      const page = await openFixture(editor.page);
      if (editor.page.startsWith('editors/')) {
        await page.waitForFunction(() => window.editorReady);
      }
      expect(await editor.read(page)).toBe(ORIGINAL);

      await selectInEditor(page, editor.editable, 'we', 'failed.');
      const popup = await invokeExtensionOn(page);
      await expect(popup.getByRole('textbox', { name: 'Text to improve' })).toHaveValue(
        'we was late and teh build failed.'
      );
      await popup.getByRole('button', { name: 'Fix grammar' }).click();
      await expect(popup.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
        'we were late and the build failed.',
        { timeout: ENGINE_TIMEOUT }
      );
      return { page, popup };
    }

    // WB-E2E-023
    test('reads the selection and applies fixes, keeping formatting', async ({
      openFixture,
      invokeExtensionOn,
    }) => {
      const { page, popup } = await openAndFix({ openFixture, invokeExtensionOn });

      await popup.getByRole('button', { name: 'Replace on page' }).click();
      await expect(popup.getByRole('group', { name: 'Confirm replacement' })).toContainText(
        'Make these 2 changes'
      );
      await popup.getByRole('button', { name: 'Yes, replace' }).click();
      await expect(popup.getByText(/Replaced on the page\./)).toBeVisible();

      // The editor's own model holds the fix, not just its DOM.
      await expect.poll(() => editor.read(page)).toBe(FIXED);
      const editable = page.locator(editor.editable);
      await expect(editable.locator('b, strong').first()).toHaveText('were late');
      if (editor.hasLink) {
        const link = editable.locator('a');
        await expect(link).toHaveText('the build');
        await expect(link).toHaveAttribute('href', 'https://example.com/build');
      }
      // Still two paragraphs: no line breaks were added or removed.
      await expect(editable.locator('p')).toHaveCount(2);
    });

    // WB-E2E-024
    test('Ctrl+Z in the editor undoes the changes', async ({ openFixture, invokeExtensionOn }) => {
      const { page, popup } = await openAndFix({ openFixture, invokeExtensionOn });
      await popup.getByRole('button', { name: 'Replace on page' }).click();
      await popup.getByRole('button', { name: 'Yes, replace' }).click();
      await expect.poll(() => editor.read(page)).toBe(FIXED);

      // Editors group edits made close together differently, so press until
      // the original is back, with a bound so a broken undo still fails.
      await page.bringToFront();
      await page.locator(editor.editable).focus();
      for (let presses = 0; presses < 4 && (await editor.read(page)) !== ORIGINAL; presses++) {
        await page.keyboard.press('ControlOrMeta+z');
      }

      expect(await editor.read(page)).toBe(ORIGINAL);
    });
  });
}
