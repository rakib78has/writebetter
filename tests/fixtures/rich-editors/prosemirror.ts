// Test page: ProseMirror, the engine behind TipTap, Atlassian, the NYT and others.
import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { DOMParser } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { exposeEditor, INITIAL_HTML } from './shared.ts';

const source = document.createElement('div');
source.innerHTML = INITIAL_HTML; // eslint-disable-line no-restricted-properties -- trusted fixture markup

const view = new EditorView(document.getElementById('editor'), {
  state: EditorState.create({
    doc: DOMParser.fromSchema(schema).parse(source),
    plugins: [history(), keymap({ 'Mod-z': undo, 'Mod-y': redo }), keymap(baseKeymap)],
  }),
});

// The editor's own model, not the DOM: proves the change reached the editor.
exposeEditor(() => view.state.doc.textBetween(0, view.state.doc.content.size, '\n'));
