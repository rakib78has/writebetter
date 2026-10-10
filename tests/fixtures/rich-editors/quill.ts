// Test page: Quill, a widely embedded rich-text editor.
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { exposeEditor, INITIAL_HTML } from './shared.ts';

const host = document.getElementById('editor') as HTMLElement;
const quill = new Quill(host, { theme: 'snow' });
quill.clipboard.dangerouslyPasteHTML(INITIAL_HTML);
quill.history.clear();

// Quill always ends its text with "\n"; trimmed so pages compare equally.
exposeEditor(() => quill.getText().replace(/\n$/, ''));
