// Test page: Lexical, Meta's editor framework (used on Facebook and elsewhere).
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type LexicalEditor,
} from 'lexical';
import { exposeEditor } from './shared.ts';

const editor: LexicalEditor = createEditor({
  namespace: 'writebetter-test',
  nodes: [HeadingNode, QuoteNode],
  onError: (error) => {
    throw error;
  },
});
editor.setRootElement(document.getElementById('editor'));
mergeRegister(registerRichText(editor), registerHistory(editor, createEmptyHistoryState(), 300));

// Same content as the other pages. Lexical's link node lives in a separate
// package, so this page has bold text but no link.
editor.update(
  () => {
    const first = $createParagraphNode().append(
      $createTextNode('Hi all, we '),
      $createTextNode('was late').toggleFormat('bold'),
      $createTextNode(' and teh build failed.')
    );
    const second = $createParagraphNode().append($createTextNode('Thanks for your patience.'));
    $getRoot().clear().append(first, second);
  },
  { discrete: true }
);

exposeEditor(() =>
  editor
    .getEditorState()
    .read(() => $getRoot().getTextContent())
    .replace(/\n\n/g, '\n')
);
