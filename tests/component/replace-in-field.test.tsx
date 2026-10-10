import { render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { replaceInField } from '../../src/content/replace-in-field.ts';

/**
 * replaceInField() against jsdom. jsdom has no document.execCommand, so
 * these tests exercise the setRangeText fallback; the end-to-end suite runs
 * the execCommand path (with native undo) in real Chromium.
 */

function mount(html: string): HTMLInputElement | HTMLTextAreaElement {
  document.body.innerHTML = html; // eslint-disable-line no-restricted-properties -- trusted test markup
  const element = document.body.firstElementChild;
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error(`Markup is not a text field: ${html}`);
  }
  element.focus();
  return element;
}

const request = (start: number, end: number, expected: string, replacement: string) => ({
  start,
  end,
  expected,
  replacement,
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('replaceInField', () => {
  // WB-INT-036
  it('replaces the expected text and selects the new text', () => {
    const field = mount('<textarea>Dear team, their is a problem.</textarea>');

    expect(replaceInField(request(11, 29, 'their is a problem', 'there is a problem'))).toEqual({
      status: 'replaced',
    });
    expect(field.value).toBe('Dear team, there is a problem.');
    expect([field.selectionStart, field.selectionEnd]).toEqual([11, 29]);
  });

  // WB-INT-037
  it('fires input and change events so page scripts notice the change', () => {
    const field = mount('<input type="text" value="teh end">');
    const events: string[] = [];
    field.addEventListener('input', (event) =>
      events.push(`input:${(event as InputEvent).inputType}`)
    );
    field.addEventListener('change', () => events.push('change'));

    replaceInField(request(0, 3, 'teh', 'the'));

    expect(events).toEqual(['input:insertReplacementText', 'change']);
  });

  // WB-INT-038
  it('updates a React-controlled field, as on sites built with React', () => {
    const seen = vi.fn();
    function Form() {
      const [value, setValue] = useState('teh end');
      return (
        <input
          aria-label="draft"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            seen(event.target.value);
          }}
        />
      );
    }
    const { getByLabelText } = render(<Form />);
    const field = getByLabelText('draft') as HTMLInputElement;
    field.focus();

    replaceInField(request(0, 3, 'teh', 'the'));

    expect(seen).toHaveBeenCalledWith('the end');
    expect(field.value).toBe('the end');
  });

  // WB-INT-039
  it('can remove text', () => {
    const field = mount('<textarea>and and done</textarea>');
    expect(replaceInField(request(0, 4, 'and ', ''))).toEqual({ status: 'replaced' });
    expect(field.value).toBe('and done');
  });

  // WB-INT-040
  it('keeps emoji before and after the change intact', () => {
    const field = mount('<textarea>👋🏽 teh 👨‍👩‍👧</textarea>');
    const start = field.value.indexOf('teh');
    replaceInField(request(start, start + 3, 'teh', 'the'));
    expect(field.value).toBe('👋🏽 the 👨‍👩‍👧');
  });

  // WB-SEC-019
  it('changes nothing if the text has changed since it was read', () => {
    const field = mount('<textarea>Dear team, I fixed it myself.</textarea>');
    expect(replaceInField(request(11, 29, 'their is a problem', 'there is a problem'))).toEqual({
      status: 'changed',
    });
    expect(field.value).toBe('Dear team, I fixed it myself.');
  });

  // WB-INT-041
  it('changes nothing if the result would exceed maxlength', () => {
    const field = mount('<input type="text" maxlength="7" value="its ok">');
    expect(replaceInField(request(0, 3, 'its', 'it is'))).toEqual({ status: 'too-long' });
    expect(field.value).toBe('its ok');
  });

  // WB-INT-042
  it('refuses a read-only field', () => {
    const field = mount('<textarea readonly>teh</textarea>');
    expect(replaceInField(request(0, 3, 'teh', 'the'))).toEqual({ status: 'read-only' });
    expect(field.value).toBe('teh');
  });

  // WB-INT-043
  it('reports the field as gone when focus is not in a text field', () => {
    mount('<textarea>teh</textarea>');
    (document.activeElement as HTMLElement).blur();
    expect(replaceInField(request(0, 3, 'teh', 'the'))).toEqual({ status: 'field-gone' });
  });

  // WB-SEC-020
  it.each([
    '<input type="password" value="hunter2">',
    '<input type="text" autocomplete="one-time-code" value="123456">',
  ])('never reads or writes a sensitive field: %s', (html) => {
    const field = mount(html);
    Object.defineProperty(field, 'value', {
      get() {
        throw new Error('a sensitive value was read');
      },
    });
    expect(replaceInField(request(0, 3, 'hun', 'xxx'))).toEqual({ status: 'field-gone' });
  });
});
