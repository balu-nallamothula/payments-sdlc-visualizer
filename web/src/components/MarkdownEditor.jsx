import {
  MDXEditor,
  toolbarPlugin,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  markdownShortcutPlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  Separator,
  DiffSourceToggleWrapper,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { useTheme } from '../context/ThemeContext';

// Languages offered for fenced code blocks (editable via CodeMirror).
const CODE_LANGS = {
  '': 'Plain text',
  js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
  json: 'JSON', bash: 'Bash', sh: 'Shell', shell: 'Shell',
  py: 'Python', python: 'Python', md: 'Markdown', yaml: 'YAML', yml: 'YAML',
  html: 'HTML', css: 'CSS', java: 'Java', go: 'Go', sql: 'SQL', graphql: 'GraphQL', txt: 'Plain text',
};

// WYSIWYG Markdown editor: edit directly in the formatted document (toolbar
// applies formatting live), with a built-in Rich/Source toggle for the raw
// markdown "code" view. Markdown in (`markdown`), markdown out (`onChange`).
export default function MarkdownEditor({ value, onChange }) {
  const { theme } = useTheme();
  return (
    <MDXEditor
      markdown={value}
      onChange={onChange}
      className={`sdlc-mdx${theme === 'dark' ? ' dark-theme' : ''}`}
      contentEditableClassName="sdlc-mdx-content"
      onError={(payload) => {
        // Unsupported markdown node — log instead of crashing; the Source view
        // still shows the raw text.
        // eslint-disable-next-line no-console
        console.warn('Markdown editor:', payload?.error || payload);
      }}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
        codeMirrorPlugin({ codeBlockLanguages: CODE_LANGS }),
        markdownShortcutPlugin(),
        diffSourcePlugin({ viewMode: 'rich' }),
        toolbarPlugin({
          toolbarContents: () => (
            <DiffSourceToggleWrapper options={['rich', 'source']}>
              <UndoRedo />
              <Separator />
              <BoldItalicUnderlineToggles />
              <Separator />
              <BlockTypeSelect />
              <ListsToggle />
              <Separator />
              <CreateLink />
              <InsertTable />
              <InsertThematicBreak />
            </DiffSourceToggleWrapper>
          ),
        }),
      ]}
    />
  );
}
