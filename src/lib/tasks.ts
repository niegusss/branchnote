/** GFM task-list helpers shared by the preview's interactive checkboxes. */
import { visit } from "unist-util-visit";
import type { Node } from "unist";

/** A GFM task list item: a list marker, then `[ ]` / `[x]` / `[X]`. */
const TASK_RE = /^(\s*[-*+]\s+\[)([ xX])(\])/;

interface HastElement extends Node {
  tagName?: string;
  properties?: Record<string, unknown>;
}

/**
 * rehype plugin (use AFTER `rehype-sanitize`): tag each GFM task checkbox with a
 * document-order `data-task-index`. The preview reads it to map a clicked
 * checkbox back to the i-th task in the source — assigned during the unified
 * transform, so it's deterministic and immune to React StrictMode double-renders
 * (a render-time counter is not). Runs after sanitize, so no schema change.
 */
export function rehypeTaskIndex() {
  return (tree: Node): void => {
    let i = 0;
    visit(tree, "element", (node: Node) => {
      const el = node as HastElement;
      if (el.tagName === "input" && el.properties && el.properties.type === "checkbox") {
        el.properties.dataTaskIndex = i++;
      }
    });
  };
}

/**
 * Flip the `index`-th task marker (`[ ]` ↔ `[x]`) in `content`, counting tasks
 * in document order. Returns the original string if there is no such task.
 *
 * The index matches the order remark-gfm renders checkboxes, so the i-th
 * checkbox in the preview maps to the i-th task here.
 */
export function toggleTask(content: string, index: number): string {
  const lines = content.split("\n");
  let seen = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TASK_RE);
    if (!m) continue;
    seen++;
    if (seen === index) {
      const next = m[2] === " " ? "x" : " ";
      lines[i] = lines[i].replace(TASK_RE, `$1${next}$3`);
      break;
    }
  }
  return lines.join("\n");
}
