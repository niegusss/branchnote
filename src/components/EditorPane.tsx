import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { darkEditorTheme, lightEditorTheme } from "../lib/editorTheme";

interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
  effectiveTheme: "light" | "dark";
  /** Focus the editor and place the cursor at the end (for freshly created notes). */
  autoFocusEnd?: boolean;
  /** Called once after an autoFocusEnd focus, so the parent can clear its signal. */
  onAutoFocused?: () => void;
}

/**
 * Keep the first line a heading: if an edit leaves line 1 not starting with
 * `#`, re-insert `"# "` at the top. The title of a note is its first line, and
 * it must stay a big H1 (visible in preview). CodeMirror maps the selection
 * through the inserted change, so the cursor never jumps.
 */
const enforceHeading = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  const first = tr.newDoc.line(1).text;
  if (first.startsWith("#")) return tr;
  return [tr, { changes: { from: 0, insert: "# " } }];
});

// Markdown grammar only — we deliberately don't load every language grammar
// (`@codemirror/language-data`) to keep the bundle lean per the brief.
const extensions = [
  markdown({ base: markdownLanguage }),
  EditorView.lineWrapping,
  enforceHeading,
];

/**
 * Plain markdown editor (CodeMirror 6). No rich-text / WYSIWYG — the brief
 * keeps editing to plain markdown with syntax highlighting.
 */
export function EditorPane({
  value,
  onChange,
  effectiveTheme,
  autoFocusEnd,
  onAutoFocused,
}: EditorPaneProps) {
  return (
    <section
      aria-label="Markdown editor"
      className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg"
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          height="100%"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          theme={effectiveTheme === "dark" ? darkEditorTheme : lightEditorTheme}
          onCreateEditor={(view) => {
            if (autoFocusEnd) {
              view.focus();
              view.dispatch({ selection: { anchor: view.state.doc.length } });
              onAutoFocused?.();
            }
          }}
          aria-label="Markdown source"
        />
      </div>
    </section>
  );
}
