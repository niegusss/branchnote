import { useEffect, useMemo, useRef } from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { search, searchKeymap } from "@codemirror/search";
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
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
  /** Note basenames offered as `[[wikilink]]` autocompletions. */
  wikiNames?: string[];
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

/** Completion source for `[[wikilinks]]`: once `[[` is typed, suggest note
 *  names (read live from a ref so the editor isn't rebuilt as files change). */
function wikiCompletions(
  namesRef: React.MutableRefObject<string[]>,
) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.matchBefore(/\[\[[^\]\n]*$/);
    if (!before) return null;
    const names = namesRef.current;
    if (names.length === 0) return null;
    return {
      from: before.from + 2,
      options: names.map((n) => ({
        label: n,
        type: "text",
        // `closeBrackets` may have already inserted the closing `]]` when `[[`
        // was typed — only add it ourselves if it isn't already there, so we
        // never end up with `[[name]]]]`. Cursor lands after the closing `]]`.
        apply: (view: EditorView, _c: unknown, from: number, to: number) => {
          const hasClose = view.state.sliceDoc(to, to + 2) === "]]";
          view.dispatch({
            changes: { from, to, insert: hasClose ? n : n + "]]" },
            selection: { anchor: from + n.length + 2 },
          });
        },
      })),
      validFor: /^[^\]\n]*$/,
    };
  };
}

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
  wikiNames,
}: EditorPaneProps) {
  // Latest note names for the wikilink completion source, without rebuilding
  // the editor (extensions stay stable; the source reads this ref).
  const namesRef = useRef<string[]>(wikiNames ?? []);
  useEffect(() => {
    namesRef.current = wikiNames ?? [];
  }, [wikiNames]);

  // Markdown grammar only — we deliberately don't load every language grammar
  // (`@codemirror/language-data`) to keep the bundle lean per the brief.
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      enforceHeading,
      search({ top: true }),
      keymap.of(searchKeymap),
      autocompletion({ override: [wikiCompletions(namesRef)] }),
    ],
    [],
  );

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
          // `h-full` on the react-codemirror wrapper keeps the height:100% chain
          // intact down to `.cm-editor`, so `.cm-scroller` overflows and scrolls
          // (without it the wrapper is auto-height and content is just clipped).
          className="h-full"
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
