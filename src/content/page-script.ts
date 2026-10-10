import type { CaptureResult } from '../shared/capture.ts';
import type { ReplaceRequest, ReplaceResult } from '../shared/replace.ts';

export type PageRequest = { type: 'capture' } | { type: 'replace'; request: ReplaceRequest };

/**
 * Everything WriteBetter does inside a web page: read the user's selection,
 * and write corrections back after the user confirms.
 *
 * Injected by chrome.scripting.executeScript only after the user has invoked
 * the extension (Chrome awaits it when it returns a promise). Chrome sends
 * this function's *source code* to the page, not
 * the function itself, so it must be fully self-contained: no imports, and
 * no references to anything outside its own body. The type imports above
 * are erased at build time and are fine. Reading and writing share helpers,
 * which is why both live in this one function.
 *
 * Privacy rules enforced here:
 * - Only the selected text is read, never the rest of the field or page.
 * - Password, one-time-code and payment fields are recognised from their
 *   attributes and their value is never touched.
 */
export function runInPage(message: { type: 'capture' }): CaptureResult;
export function runInPage(message: {
  type: 'replace';
  request: ReplaceRequest;
}): Promise<ReplaceResult>;
export function runInPage(message: PageRequest): CaptureResult | Promise<ReplaceResult>;
export function runInPage(message: PageRequest): CaptureResult | Promise<ReplaceResult> {
  // Input types whose value can be selected and read through the
  // selectionStart/selectionEnd API. Others (email, number, date...) either
  // don't support it or don't hold prose.
  const SELECTABLE_INPUT_TYPES = ['text', 'search', 'url', 'tel'];
  // Autocomplete tokens that mark a field as sensitive even when its type
  // is plain text.
  const SENSITIVE_AUTOCOMPLETE =
    /(?:^|\s)(?:current-password|new-password|one-time-code|cc-\S+)(?:\s|$)/i;
  // Elements that start a new line of text inside a rich-text editor.
  const BLOCK_TAGS =
    /^(?:ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DD|DIV|DL|DT|FIGCAPTION|FIGURE|FOOTER|H[1-6]|HEADER|HR|LI|OL|P|PRE|SECTION|TABLE|TD|TH|TR|UL)$/;

  type Target =
    | { kind: 'text-field'; field: HTMLInputElement | HTMLTextAreaElement }
    | { kind: 'rich'; host: HTMLElement }
    | { kind: 'sensitive' }
    | { kind: 'unsupported'; reason: 'frame' | 'input-type' }
    | { kind: 'none' };

  /** Identifies what kind of editing surface has focus. */
  function findTarget(): Target {
    let element = document.activeElement;
    // Focus inside an open shadow root shows up as the shadow host. Follow it
    // down to the element that actually has focus.
    while (element?.shadowRoot?.activeElement) {
      element = element.shadowRoot.activeElement;
    }
    if (element instanceof HTMLIFrameElement) return { kind: 'unsupported', reason: 'frame' };
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const isPassword = element instanceof HTMLInputElement && element.type === 'password';
      if (isPassword || SENSITIVE_AUTOCOMPLETE.test(element.autocomplete)) {
        return { kind: 'sensitive' };
      }
      if (element instanceof HTMLInputElement && !SELECTABLE_INPUT_TYPES.includes(element.type)) {
        return { kind: 'unsupported', reason: 'input-type' };
      }
      return { kind: 'text-field', field: element };
    }
    if (element instanceof HTMLElement && element.isContentEditable) {
      return { kind: 'rich', host: element };
    }
    return { kind: 'none' };
  }

  /**
   * The selected text of a rich-text editor, with a map from each UTF-16
   * unit of that text back to its place in the DOM. Line and paragraph breaks
   * appear as "\n" with no place (null), as does text the user can't edit
   * (inside contenteditable="false"), so no fix is ever applied there.
   */
  function readRichSelection(host: HTMLElement) {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (range.collapsed || !host.contains(range.commonAncestorContainer)) return null;

    let text = '';
    const places: ([Text, number] | null)[] = [];
    const lineBreak = () => {
      // A space just before a line break is not displayed.
      if (text.endsWith(' ')) {
        text = text.slice(0, -1);
        places.pop();
      }
      text += '\n';
      places.push(null);
    };
    // Whether whitespace is shown as typed (editors usually set pre-wrap) or
    // collapsed into single spaces, as in ordinary HTML. Cached per element.
    const keepsWhitespace = new Map<Element, boolean>();
    const preserves = (element: Element | null) => {
      if (!element) return false;
      let keeps = keepsWhitespace.get(element);
      if (keeps === undefined) {
        const style = getComputedStyle(element).whiteSpace;
        keeps = style.startsWith('pre') || style === 'break-spaces';
        keepsWhitespace.set(element, keeps);
      }
      return keeps;
    };

    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node: Node | null = root; node; node = walker.nextNode()) {
      if (!range.intersectsNode(node)) continue;
      if (node instanceof Element) {
        if (node.tagName === 'BR') lineBreak();
        else if (
          node !== root &&
          BLOCK_TAGS.test(node.tagName) &&
          text !== '' &&
          !text.endsWith('\n')
        ) {
          lineBreak();
        }
        continue;
      }
      if (!(node instanceof Text)) continue;
      // Whitespace that only formats the HTML source (between block tags) is
      // not part of the text the user sees.
      if (/^\s*\n\s*$/.test(node.data)) continue;
      const from = node === range.startContainer ? range.startOffset : 0;
      const to = node === range.endContainer ? range.endOffset : node.data.length;
      const editable = node.parentElement?.isContentEditable ?? false;
      const collapse = !preserves(node.parentElement);
      for (let i = from; i < to; i++) {
        let char = node.data[i] ?? '';
        if (collapse && /\s/.test(char)) {
          // Read text as displayed: a run of whitespace is one space, and
          // none at the start of a line. The space maps to the run's first
          // character, so a fix covering it covers the whole run.
          if (text === '' || /\s$/.test(text)) continue;
          char = ' ';
        }
        text += char;
        places.push(editable ? [node, i] : null);
      }
    }
    if (text.endsWith(' ')) {
      text = text.slice(0, -1);
      places.pop();
    }
    return { selection, text, places };
  }

  /** Collapses whitespace, for comparing text read in different ways. */
  const normalise = (value: string) => value.replace(/\s+/g, ' ').trim();

  /** Waits for a task to pass. MessageChannel is used rather than setTimeout
   *  because browsers throttle timers in background tabs. */
  const nextTask = () =>
    new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });

  /**
   * Waits until the page has seen a selection change. Editors such as
   * Lexical keep their own copy of the selection, updated on the
   * "selectionchange" event; editing before that lands on the old selection.
   */
  const selectionSettled = () =>
    new Promise<void>((resolve) => {
      const done = () => {
        document.removeEventListener('selectionchange', done);
        clearTimeout(timer);
        void nextTask().then(resolve);
      };
      // No event fires if the selection didn't actually change.
      const timer = setTimeout(done, 100);
      document.addEventListener('selectionchange', done);
    });

  function capture(): CaptureResult {
    const target = findTarget();
    switch (target.kind) {
      case 'sensitive':
        return { status: 'sensitive-field' };
      case 'unsupported':
        return { status: 'unsupported-field', reason: target.reason };
      case 'none':
        return { status: 'no-field' };
      case 'rich': {
        const read = readRichSelection(target.host);
        if (!read || read.text.trim() === '') return { status: 'empty-selection' };
        return { status: 'captured', text: read.text, field: 'rich', readOnly: false };
      }
      case 'text-field': {
        const { field } = target;
        const start = field.selectionStart ?? 0;
        const end = field.selectionEnd ?? 0;
        if (start === end) return { status: 'empty-selection' };
        return {
          status: 'captured',
          text: field.value.slice(start, end),
          field: field instanceof HTMLInputElement ? 'input' : 'textarea',
          selection: { start, end },
          readOnly: field.readOnly || field.disabled,
        };
      }
    }
  }

  // execCommand edits the page the way typing does: the change joins the
  // browser's (or editor's) own undo history, so Ctrl+Z works, and fires the
  // input events that page frameworks and rich-text editors listen for. It
  // is deprecated, but nothing else preserves undo or works with editors.
  function insertText(text: string): boolean {
    /* eslint-disable @typescript-eslint/no-deprecated -- deliberate, see above */
    if (typeof document.execCommand !== 'function') return false;
    return text === ''
      ? document.execCommand('delete')
      : document.execCommand('insertText', false, text);
    /* eslint-enable @typescript-eslint/no-deprecated */
  }

  function replaceInTextField(
    field: HTMLInputElement | HTMLTextAreaElement,
    request: Extract<ReplaceRequest, { kind: 'text-field' }>
  ): ReplaceResult {
    if (field.readOnly || field.disabled) return { status: 'read-only' };
    const { start, end, expected, replacement } = request;
    if (field.value.slice(start, end) !== expected) return { status: 'changed' };

    const newLength = field.value.length - (end - start) + replacement.length;
    if (field.maxLength >= 0 && newLength > field.maxLength) return { status: 'too-long' };

    field.focus();
    field.setSelectionRange(start, end);
    if (!insertText(replacement)) {
      // Where execCommand is unavailable, set the text directly and announce
      // it. Undo is lost on this path.
      field.setRangeText(replacement, start, end, 'end');
      field.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertReplacementText',
          data: replacement,
        })
      );
    }
    field.dispatchEvent(new Event('change', { bubbles: true }));

    const after = start + replacement.length;
    if (field.value.slice(start, after) !== replacement) return { status: 'failed' };
    // Select the new text so the user can see exactly what changed.
    field.setSelectionRange(start, after);
    return { status: 'replaced' };
  }

  async function replaceInRichEditor(
    host: HTMLElement,
    request: Extract<ReplaceRequest, { kind: 'rich' }>
  ): Promise<ReplaceResult> {
    const read = readRichSelection(host);
    if (!read || read.text !== request.expected) return { status: 'changed' };

    // Turn every fix into a live Range first. The browser keeps live Ranges
    // pointing at the same text while other parts of the DOM change.
    const planned: { range: Range; original: string; replacement: string }[] = [];
    for (const fix of [...request.fixes].sort((a, b) => a.start - b.start)) {
      const places = read.places.slice(fix.start, fix.end);
      const first = places[0];
      const last = places[places.length - 1];
      // Skip a fix that spans a line break or uneditable text: there is no
      // single place in the editor to apply it.
      if (!first || !last || places.includes(null)) continue;
      if (read.text.slice(fix.start, fix.end) !== fix.original) continue;
      const range = document.createRange();
      range.setStart(first[0], first[1]);
      range.setEnd(last[0], last[1] + 1);
      planned.push({ range, original: fix.original, replacement: fix.replacement });
    }

    host.focus({ preventScroll: true });
    let applied = 0;
    // Last to first, so each edit leaves the text before it untouched.
    for (const { range, original, replacement } of planned.reverse()) {
      // Editors may re-render text after an edit. If this word is no longer
      // exactly where it was, stop rather than edit the wrong place.
      const removed = range.toString();
      if (normalise(removed) !== normalise(original)) break;

      // What the editor's whole text must be once this edit lands. Checked
      // afterwards, because an editor applies edits through its own model
      // and could put them somewhere else.
      const before = host.textContent;
      const lead = document.createRange();
      lead.setStart(host, 0);
      lead.setEnd(range.startContainer, range.startOffset);
      const at = lead.toString().length;
      const expectedAfter = before.slice(0, at) + replacement + before.slice(at + removed.length);

      read.selection.removeAllRanges();
      read.selection.addRange(range);
      await selectionSettled();
      if (!insertText(replacement)) break;
      await nextTask();

      if (host.textContent !== expectedAfter) {
        // Stop at once rather than build further edits on a wrong one.
        return { status: 'unexpected', applied };
      }
      applied++;
    }

    const total = request.fixes.length;
    if (applied === total) return { status: 'replaced' };
    return applied === 0 ? { status: 'failed' } : { status: 'partial', applied, total };
  }

  async function replace(request: ReplaceRequest): Promise<ReplaceResult> {
    const target = findTarget();
    if (request.kind === 'text-field') {
      return target.kind === 'text-field'
        ? replaceInTextField(target.field, request)
        : { status: 'field-gone' };
    }
    return target.kind === 'rich'
      ? replaceInRichEditor(target.host, request)
      : { status: 'field-gone' };
  }

  return message.type === 'capture' ? capture() : replace(message.request);
}
