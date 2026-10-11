import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runInPage } from '../../src/content/page-script.ts';
import type { RichFix } from '../../src/shared/replace.ts';

/**
 * Rich-text editors (contenteditable) in jsdom.
 *
 * jsdom implements neither isContentEditable nor execCommand. Both are
 * stood in for here so the page script's own logic (reading the selection,
 * mapping text back to the DOM, applying fixes in place) can be tested
 * quickly and in detail. Real Chromium and real editor libraries are covered
 * by tests/e2e/rich-editors.spec.ts.
 */

const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'isContentEditable');
let execCommandCalls: string[] = [];

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
    configurable: true,
    get(this: HTMLElement) {
      const host = this.closest('[contenteditable]');
      return host !== null && host.getAttribute('contenteditable') !== 'false';
    },
  });
  // A minimal insertText: replace the current selection with plain text,
  // as Chromium does for a selection inside one text node.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- standing in for it, see above
  document.execCommand = (command: string, _ui?: boolean, value?: string) => {
    execCommandCalls.push(`${command}:${value ?? ''}`);
    const range = document.getSelection()?.getRangeAt(0);
    if (!range) return false;
    range.deleteContents();
    if (command === 'insertText' && value) range.insertNode(document.createTextNode(value));
    return true;
  };
});

afterAll(() => {
  if (descriptor) Object.defineProperty(HTMLElement.prototype, 'isContentEditable', descriptor);
  Reflect.deleteProperty(document, 'execCommand');
});

afterEach(() => {
  document.body.replaceChildren();
  execCommandCalls = [];
});

/** Mounts an editor, focuses it, and selects from `from` to `to`, matched as
 *  text in document order (the end is the end of the `to` match). */
function editorWithSelection(html: string, from: string, to: string): HTMLElement {
  document.body.innerHTML = html; // eslint-disable-line no-restricted-properties -- trusted test markup
  const host = document.querySelector<HTMLElement>('[contenteditable="true"]');
  if (!host) throw new Error('No editor in markup');
  host.focus();

  const texts: Text[] = [];
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  const find = (needle: string, atEnd: boolean): [Text, number] => {
    for (const node of texts) {
      const index = node.data.indexOf(needle);
      if (index >= 0) return [node, atEnd ? index + needle.length : index];
    }
    throw new Error(`"${needle}" not found`);
  };

  const range = document.createRange();
  range.setStart(...find(from, false));
  range.setEnd(...find(to, true));
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  return host;
}

const capture = () => runInPage({ type: 'capture' });
const replace = (expected: string, fixes: RichFix[]) =>
  runInPage({ type: 'replace', request: { kind: 'rich', expected, fixes } });

/** A fix for the first occurrence of `original` in `text`. */
function fix(text: string, original: string, replacement: string): RichFix {
  const start = text.indexOf(original);
  return { start, end: start + original.length, original, replacement };
}

describe('capturing from a rich-text editor', () => {
  // WB-INT-048
  it('reads the selection, across formatting, as plain text', () => {
    editorWithSelection(
      '<div contenteditable="true">Hi all, we <b>was late</b> and <a href="/x">teh build</a> failed.</div>',
      'we',
      'failed.'
    );
    expect(capture()).toEqual({
      status: 'captured',
      text: 'we was late and teh build failed.',
      field: 'rich',
      readOnly: false,
    });
  });

  // WB-INT-049
  it('turns paragraphs and line breaks into single newlines', () => {
    editorWithSelection(
      '<div contenteditable="true"><p>First line.</p><p>Second <br>line.</p><div><br></div><div>Third.</div></div>',
      'First',
      'Third.'
    );
    // The space before <br> is dropped: browsers don't display it either.
    expect(capture()).toMatchObject({ text: 'First line.\nSecond\nline.\n\nThird.' });
  });

  // WB-INT-050
  it('ignores whitespace that only formats the HTML source', () => {
    editorWithSelection(
      `<div contenteditable="true">
        <p>One.</p>
        <p>Two.</p>
      </div>`,
      'One.',
      'Two.'
    );
    expect(capture()).toMatchObject({ text: 'One.\nTwo.' });
  });

  // WB-INT-058
  it('reads whitespace as displayed: runs collapsed to one space', () => {
    editorWithSelection('<div contenteditable="true">we   was\n   late</div>', 'we', 'late');
    expect(capture()).toMatchObject({ text: 'we was late' });
  });

  // WB-INT-060
  it('refuses an oversized selection in an editor', () => {
    editorWithSelection(
      `<div contenteditable="true">start ${'word '.repeat(9_000)} end</div>`,
      'start',
      'end'
    );
    expect(capture()).toEqual({ status: 'too-long' });
  });

  // WB-INT-051
  it('reports an empty selection when only the caret is in the editor', () => {
    const host = editorWithSelection('<div contenteditable="true">Text</div>', 'Te', 'Te');
    document.getSelection()?.collapseToEnd();
    expect(host).toHaveFocus();
    expect(capture()).toEqual({ status: 'empty-selection' });
  });

  // WB-INT-052
  it('reports an empty selection when the selection is outside the focused editor', () => {
    document.body.innerHTML = // eslint-disable-line no-restricted-properties -- trusted test markup
      '<p id="outside">Outside text</p><div contenteditable="true">Editor</div>';
    document.querySelector<HTMLElement>('[contenteditable]')?.focus();
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('outside') as HTMLElement);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    expect(capture()).toEqual({ status: 'empty-selection' });
  });
});

describe('fixing text in a rich-text editor', () => {
  // WB-INT-053
  it('edits only the words that change, keeping bold text and links', async () => {
    const host = editorWithSelection(
      '<div contenteditable="true">Hi all, we <b>was late</b> and <a href="/x">teh build</a> failed.</div>',
      'we',
      'failed.'
    );
    const text = 'we was late and teh build failed.';

    expect(await replace(text, [fix(text, 'was', 'were'), fix(text, 'teh', 'the')])).toEqual({
      status: 'replaced',
    });

    expect(host.textContent).toBe('Hi all, we were late and the build failed.');
    expect(host.querySelector('b')?.textContent).toBe('were late');
    expect(host.querySelector('a')?.textContent).toBe('the build');
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/x');
    // Applied last to first, so earlier positions are never disturbed.
    expect(execCommandCalls).toEqual(['insertText:the', 'insertText:were']);
  });

  // WB-INT-054
  it('keeps paragraphs intact', async () => {
    const host = editorWithSelection(
      '<div contenteditable="true"><p>First has teh typo.</p><p>Second we was late.</p></div>',
      'First',
      'late.'
    );
    const text = 'First has teh typo.\nSecond we was late.';

    await replace(text, [fix(text, 'teh', 'the'), fix(text, 'was', 'were')]);

    expect([...host.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'First has the typo.',
      'Second we were late.',
    ]);
  });

  // WB-INT-055
  it('applies a fix to a word split across formatting', async () => {
    const host = editorWithSelection(
      '<div contenteditable="true">This is <b>t</b>eh end</div>',
      'This',
      'end'
    );
    const text = 'This is teh end';

    expect(await replace(text, [fix(text, 'teh', 'the')])).toEqual({ status: 'replaced' });
    expect(host.textContent).toBe('This is the end');
  });

  // WB-SEC-025
  it('changes nothing if the editor text no longer matches what was checked', async () => {
    const host = editorWithSelection('<div contenteditable="true">we was late</div>', 'we', 'late');
    expect(await replace('we was early', [fix('we was early', 'was', 'were')])).toEqual({
      status: 'changed',
    });
    expect(host.textContent).toBe('we was late');
    expect(execCommandCalls).toEqual([]);
  });

  // WB-INT-056
  it('skips a fix that spans a line break, and says the result was partial', async () => {
    const host = editorWithSelection(
      '<div contenteditable="true"><p>end and</p><p>and teh rest</p></div>',
      'end',
      'rest'
    );
    const text = 'end and\nand teh rest';
    const acrossBreak = { start: 4, end: 11, original: 'and\nand', replacement: 'and' };

    expect(await replace(text, [acrossBreak, fix(text, 'teh', 'the')])).toEqual({
      status: 'partial',
      applied: 1,
      total: 2,
    });
    expect(host.textContent).toBe('end andand the rest');
  });

  // WB-SEC-026
  it('never edits text the user cannot edit (contenteditable="false")', async () => {
    const host = editorWithSelection(
      '<div contenteditable="true">Sent by <span contenteditable="false">teh bot</span>, teh end</div>',
      'Sent',
      'end'
    );
    const text = 'Sent by teh bot, teh end';
    const inLockedPart = fix(text, 'teh', 'the');
    const second = text.lastIndexOf('teh');
    const inEditablePart = { start: second, end: second + 3, original: 'teh', replacement: 'the' };

    expect(await replace(text, [inLockedPart, inEditablePart])).toEqual({
      status: 'partial',
      applied: 1,
      total: 2,
    });
    expect(host.textContent).toBe('Sent by teh bot, the end');
  });

  // WB-INT-057
  it('reports the editor as gone when focus has moved to a text field', async () => {
    document.body.innerHTML = '<textarea>x</textarea>'; // eslint-disable-line no-restricted-properties -- trusted test markup
    document.querySelector('textarea')?.focus();
    expect(await replace('x', [])).toEqual({ status: 'field-gone' });
  });
});

describe('editors that apply edits through their own model', () => {
  // WB-INT-064
  it('offers each edit as beforeinput first, and skips execCommand when the editor takes it', async () => {
    const host = editorWithSelection(
      '<div contenteditable="true">This is teh end</div>',
      'This',
      'end'
    );
    // Stands in for an editor like Slate: handles beforeinput itself.
    const offered: string[] = [];
    host.addEventListener('beforeinput', (event) => {
      offered.push(`${event.inputType}:${event.data ?? ''}`);
      event.preventDefault();
      const range = document.getSelection()?.getRangeAt(0);
      range?.deleteContents();
      if (event.data) range?.insertNode(document.createTextNode(event.data));
    });

    const text = 'This is teh end';
    expect(await replace(text, [fix(text, 'teh', 'the')])).toEqual({ status: 'replaced' });

    expect(offered).toEqual(['insertText:the']);
    expect(execCommandCalls).toEqual([]);
    expect(host.textContent).toBe('This is the end');
  });

  // WB-INT-065
  it('signals the end of the edit, so editors that save undo steps on it do', async () => {
    const host = editorWithSelection(
      '<div contenteditable="true">This is teh end</div>',
      'This',
      'end'
    );
    const keys: string[] = [];
    host.addEventListener('keyup', (event) => keys.push(event.key));

    const text = 'This is teh end';
    await replace(text, [fix(text, 'teh', 'the')]);

    expect(keys).toEqual(['End']);
  });

  // WB-INT-066
  it('sends no signal when nothing was changed', async () => {
    const host = editorWithSelection('<div contenteditable="true">we was late</div>', 'we', 'late');
    const keys: string[] = [];
    host.addEventListener('keyup', (event) => keys.push(event.key));

    await replace('we was early', [fix('we was early', 'was', 'were')]);

    expect(keys).toEqual([]);
  });
});
