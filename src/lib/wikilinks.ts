/** `[[wikilink]]` support: a remark plugin that turns `[[Target]]` /
 *  `[[Target|alias]]` text into link nodes, plus a target-normalizer shared by
 *  the editor (autocomplete) and the preview (existence styling / open).
 *
 *  Links get a relative `?wiki=<target>` URL that survives `rehype-sanitize`
 *  and is intercepted in `PreviewPane`'s `a` renderer. Operating on mdast text
 *  nodes means code spans/fences (other node types) are left untouched. */
import { visit, SKIP } from "unist-util-visit";
import type { Node, Parent } from "unist";

interface TextNode extends Node {
  value: string;
}

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

const text = (value: string): Node => ({ type: "text", value }) as unknown as Node;
const link = (url: string, label: string): Node =>
  ({ type: "link", url, children: [text(label)] }) as unknown as Node;

/** remark plugin (use in `remarkPlugins`). */
export function remarkWikilinks() {
  return (tree: Node): void => {
    visit(tree, (node: Node, index, parent: Parent | undefined) => {
      if (node.type !== "text" || !parent || index == null) return;
      const value = (node as TextNode).value;
      if (!value.includes("[[")) return;

      WIKILINK.lastIndex = 0;
      const out: Node[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = WIKILINK.exec(value)) !== null) {
        const target = m[1].trim();
        if (!target) continue;
        const alias = (m[2] ?? m[1]).trim();
        if (m.index > last) out.push(text(value.slice(last, m.index)));
        out.push(link("?wiki=" + encodeURIComponent(target), alias));
        last = m.index + m[0].length;
      }
      if (out.length === 0) return;
      if (last < value.length) out.push(text(value.slice(last)));

      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
}

/** Normalize a target / file basename for case-insensitive matching. */
export function normalizeTarget(s: string): string {
  return s
    .replace(/\.(md|markdown)$/i, "")
    .trim()
    .toLowerCase();
}
