import { createTheme } from "@uiw/codemirror-themes";
import { tags as t } from "@lezer/highlight";

/**
 * CodeMirror themes that mirror the app's design tokens (see `src/index.css`).
 * Colors are concrete (CM compiles to fixed classes) but chosen to match the
 * light/dark token palette — muted gutter, indigo accent caret/selection.
 */

const MONO =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export const lightEditorTheme = createTheme({
  theme: "light",
  settings: {
    background: "#ffffff",
    foreground: "#18181b",
    caret: "#4f46e5",
    selection: "rgba(79, 70, 229, 0.20)",
    selectionMatch: "rgba(79, 70, 229, 0.12)",
    lineHighlight: "transparent",
    gutterBackground: "transparent",
    gutterForeground: "#a1a1aa",
    gutterBorder: "transparent",
    fontFamily: MONO,
  },
  styles: [
    { tag: t.heading, color: "#18181b", fontWeight: "600" },
    { tag: t.strong, color: "#18181b", fontWeight: "700" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: [t.link, t.url], color: "#4f46e5", textDecoration: "underline" },
    { tag: t.monospace, color: "#9333ea" },
    { tag: t.quote, color: "#71717a", fontStyle: "italic" },
    { tag: t.list, color: "#18181b" },
    { tag: t.processingInstruction, color: "#a1a1aa" },
    { tag: [t.comment, t.meta], color: "#a1a1aa" },
  ],
});

export const darkEditorTheme = createTheme({
  theme: "dark",
  settings: {
    background: "#19191c",
    foreground: "#e4e4e7",
    caret: "#818cf8",
    selection: "rgba(99, 102, 241, 0.28)",
    selectionMatch: "rgba(99, 102, 241, 0.18)",
    lineHighlight: "rgba(255, 255, 255, 0.04)",
    gutterBackground: "transparent",
    gutterForeground: "#6e6e76",
    gutterBorder: "transparent",
    fontFamily: MONO,
  },
  styles: [
    { tag: t.heading, color: "#f4f4f5", fontWeight: "600" },
    { tag: t.strong, color: "#f4f4f5", fontWeight: "700" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: [t.link, t.url], color: "#a5b4fc", textDecoration: "underline" },
    { tag: t.monospace, color: "#d8b4fe" },
    { tag: t.quote, color: "#a1a1aa", fontStyle: "italic" },
    { tag: t.list, color: "#e4e4e7" },
    { tag: t.processingInstruction, color: "#6e6e76" },
    { tag: [t.comment, t.meta], color: "#6e6e76" },
  ],
});
