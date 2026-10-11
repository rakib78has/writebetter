// Test page: Slate, a React-based editor framework (used by GitBook, Discord's
// composer and others). Like Lexical, it handles input through its own model.
import { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createEditor, Node, type BaseEditor, type Descendant } from 'slate';
import { withHistory, type HistoryEditor } from 'slate-history';
import {
  Editable,
  Slate,
  withReact,
  type ReactEditor,
  type RenderElementProps,
  type RenderLeafProps,
} from 'slate-react';
import { exposeEditor } from './shared.ts';

type Text = { text: string; bold?: true };
type Paragraph = { type: 'paragraph'; children: (Text | Link)[] };
type Link = { type: 'link'; url: string; children: Text[] };

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: Paragraph | Link;
    Text: Text;
  }
}

// Same content as the other pages: bold text, a link, two paragraphs.
const INITIAL: Descendant[] = [
  {
    type: 'paragraph',
    children: [
      { text: 'Hi all, we ' },
      { text: 'was late', bold: true },
      { text: ' and ' },
      { type: 'link', url: 'https://example.com/build', children: [{ text: 'teh build' }] },
      { text: ' failed.' },
    ],
  },
  { type: 'paragraph', children: [{ text: 'Thanks for your patience.' }] },
];

function renderElement({ element, attributes, children }: RenderElementProps) {
  return element.type === 'link' ? (
    <a {...attributes} href={element.url}>
      {children}
    </a>
  ) : (
    <p {...attributes}>{children}</p>
  );
}

function renderLeaf({ leaf, attributes, children }: RenderLeafProps) {
  return <span {...attributes}>{leaf.bold ? <strong>{children}</strong> : children}</span>;
}

function SlateTestEditor() {
  const editor = useMemo(() => {
    const created = withHistory(withReact(createEditor()));
    const { isInline } = created;
    created.isInline = (element) => element.type === 'link' || isInline(element);
    // The editor's own model, not the DOM: proves a change reached Slate.
    exposeEditor(() => created.children.map((node) => Node.string(node)).join('\n'));
    return created;
  }, []);
  return (
    <Slate editor={editor} initialValue={INITIAL}>
      <Editable id="slate-editor" renderElement={renderElement} renderLeaf={renderLeaf} />
    </Slate>
  );
}

const root = document.getElementById('editor');
if (!root) throw new Error('No #editor element');
createRoot(root).render(<SlateTestEditor />);
