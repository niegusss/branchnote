import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { darkEditorTheme, lightEditorTheme } from "../lib/editorTheme";

interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
  effectiveTheme: "light" | "dark";
}

// Markdown grammar only — we deliberately don't load every language grammar
// (`@codemirror/language-data`) to keep the bundle lean per the brief.
const extensions = [markdown({ base: markdownLanguage }), EditorView.lineWrapping];

/**
 * Plain markdown editor (CodeMirror 6). No rich-text / WYSIWYG — the brief
 * keeps editing to plain markdown with syntax highlighting.
 */
export function EditorPane({ value, onChange, effectiveTheme }: EditorPaneProps) {
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
          aria-label="Markdown source"
        />
      </div>
    </section>
  );
}
