// Test page: TinyMCE 7 in inline mode, where the editor is part of the page
// rather than an iframe (iframe mode is not supported; see compatibility.md).
// TinyMCE 7 is GPL-2.0-or-later; it is a dev dependency used only to build
// this local test page and is never distributed with the extension.
import tinymce from 'tinymce';
import 'tinymce/icons/default';
import 'tinymce/models/dom';
import 'tinymce/themes/silver';
import { exposeEditor, INITIAL_HTML } from './shared.ts';

const target = document.getElementById('editor');
if (!target) throw new Error('No #editor element');
target.innerHTML = INITIAL_HTML; // eslint-disable-line no-restricted-properties -- trusted fixture markup

const [editor] = await tinymce.init({
  target,
  inline: true,
  license_key: 'gpl',
  menubar: false,
  toolbar: false,
  skin: false,
  content_css: false,
  plugins: [],
});
if (!editor) throw new Error('TinyMCE did not start');

exposeEditor(() =>
  [...editor.getBody().querySelectorAll('p')]
    .map((paragraph) => paragraph.textContent.replace(/\s+/g, ' ').trim())
    .join('\n')
);
