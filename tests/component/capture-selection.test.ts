import { afterEach, describe, expect, it } from 'vitest';
import { captureSelection } from '../../src/content/capture-selection.ts';

/**
 * captureSelection() against jsdom. The end-to-end suite runs the same
 * function inside real Chromium; these tests cover the edge cases quickly.
 */

function mount(html: string): Element {
  document.body.innerHTML = html; // eslint-disable-line no-restricted-properties -- trusted test markup
  const element = document.body.firstElementChild;
  if (!element) throw new Error(`Markup produced no element: ${html}`);
  return element;
}

function select(element: HTMLInputElement | HTMLTextAreaElement, start: number, end: number) {
  element.focus();
  element.setSelectionRange(start, end);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('captureSelection', () => {
  // WB-INT-001
  it('returns only the selected part of a textarea', () => {
    const textarea = mount(
      '<textarea>Dear team, their is a problem.</textarea>'
    ) as HTMLTextAreaElement;
    select(textarea, 11, 29);

    expect(captureSelection()).toEqual({
      status: 'captured',
      text: 'their is a problem',
      field: 'textarea',
      selection: { start: 11, end: 29 },
      readOnly: false,
    });
  });

  // WB-INT-002
  it.each(['text', 'search', 'url', 'tel'])(
    'reads a selection from an input of type %s',
    (type) => {
      const input = mount(`<input type="${type}" value="abc def">`) as HTMLInputElement;
      select(input, 4, 7);

      expect(captureSelection()).toMatchObject({ status: 'captured', text: 'def', field: 'input' });
    }
  );

  // WB-INT-003
  it('keeps emoji and other multi-unit characters intact', () => {
    const textarea = mount('<textarea>Hi 👋🏽 there</textarea>') as HTMLTextAreaElement;
    select(textarea, 0, textarea.value.length);

    expect(captureSelection()).toMatchObject({ text: 'Hi 👋🏽 there' });
  });

  // WB-INT-004
  it('reports an empty selection when the caret is in a field with nothing selected', () => {
    const textarea = mount('<textarea>Some text</textarea>') as HTMLTextAreaElement;
    select(textarea, 4, 4);

    expect(captureSelection()).toEqual({ status: 'empty-selection' });
  });

  // WB-INT-005
  it('reports no field when nothing on the page has focus', () => {
    mount('<p>Just a paragraph</p>');
    expect(captureSelection()).toEqual({ status: 'no-field' });
  });

  // WB-SEC-008
  it('refuses a password field without ever reading its value', () => {
    const input = mount('<input type="password" value="hunter2">') as HTMLInputElement;
    select(input, 0, 7);
    Object.defineProperty(input, 'value', {
      get() {
        throw new Error('the password value was read');
      },
    });

    expect(captureSelection()).toEqual({ status: 'sensitive-field' });
  });

  // WB-SEC-009
  it.each([
    'one-time-code',
    'cc-number',
    'cc-csc',
    'current-password',
    'section-login new-password',
  ])('refuses a text field marked autocomplete="%s"', (autocomplete) => {
    const input = mount(
      `<input type="text" autocomplete="${autocomplete}" value="123456">`
    ) as HTMLInputElement;
    select(input, 0, 6);

    expect(captureSelection()).toEqual({ status: 'sensitive-field' });
  });

  // WB-INT-006
  it('does not treat ordinary autocomplete tokens as sensitive', () => {
    const input = mount('<input type="text" autocomplete="name" value="Ada">') as HTMLInputElement;
    select(input, 0, 3);

    expect(captureSelection()).toMatchObject({ status: 'captured', text: 'Ada' });
  });

  // WB-INT-007
  it.each(['email', 'number'])('reports an input of type %s as unsupported', (type) => {
    const input = mount(`<input type="${type}" value="5">`) as HTMLInputElement;
    input.focus();

    expect(captureSelection()).toEqual({ status: 'unsupported-field', reason: 'input-type' });
  });

  // WB-INT-008
  it('marks a read-only field so it is never offered for replacement', () => {
    const textarea = mount('<textarea readonly>Fixed text</textarea>') as HTMLTextAreaElement;
    select(textarea, 0, 5);

    expect(captureSelection()).toMatchObject({ status: 'captured', text: 'Fixed', readOnly: true });
  });

  // WB-INT-009
  it('reports a rich-text editor as unsupported', () => {
    const editor = mount(
      '<div contenteditable="true" tabindex="0">Rich text</div>'
    ) as HTMLDivElement;
    // jsdom does not implement isContentEditable; real Chromium is covered
    // by the end-to-end suite.
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    editor.focus();

    expect(captureSelection()).toEqual({ status: 'unsupported-field', reason: 'contenteditable' });
  });

  // WB-INT-010
  it('reports a focused iframe as unsupported', () => {
    const frame = mount('<iframe></iframe>') as HTMLIFrameElement;
    frame.focus();
    // jsdom does not move focus to iframes, so set what Chromium reports.
    Object.defineProperty(document, 'activeElement', { value: frame, configurable: true });

    try {
      expect(captureSelection()).toEqual({ status: 'unsupported-field', reason: 'frame' });
    } finally {
      Reflect.deleteProperty(document, 'activeElement');
    }
  });

  // WB-INT-011
  it('finds a field focused inside an open shadow root', () => {
    const host = mount('<div></div>') as HTMLDivElement;
    const textarea = document.createElement('textarea');
    textarea.value = 'inside the shadow';
    host.attachShadow({ mode: 'open' }).append(textarea);
    select(textarea, 0, 6);

    expect(captureSelection()).toMatchObject({ status: 'captured', text: 'inside' });
  });
});
