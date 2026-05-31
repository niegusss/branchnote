import { useMemo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { normalizeTarget, remarkWikilinks } from "../lib/wikilinks";

interface PreviewPaneProps {
  content: string;
  /** Normalized basenames of existing notes (for wikilink existence styling). */
  wikiTargets: Set<string>;
  /** Open (or create) the note a `[[wikilink]]` points at. */
  onOpenWikilink: (target: string) => void;
}

const remarkPlugins = [remarkGfm, remarkWikilinks];
const rehypePlugins = [rehypeSanitize];

const WIKI_PREFIX = "?wiki=";

/**
 * Rendered HTML preview. remark-gfm enables tables/task-lists; rehype-sanitize
 * strips unsafe HTML before render (note content is untrusted). `[[wikilinks]]`
 * are rendered as `?wiki=` links and intercepted here.
 */
export function PreviewPane({ content, wikiTargets, onOpenWikilink }: PreviewPaneProps) {
  const components: Components = useMemo(
    () => ({
      a({ href, children, ...props }) {
        if (href && href.startsWith(WIKI_PREFIX)) {
          const target = decodeURIComponent(href.slice(WIKI_PREFIX.length));
          const missing = !wikiTargets.has(normalizeTarget(target));
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                onOpenWikilink(target);
              }}
              title={missing ? `Create "${target}"` : target}
              className={missing ? "wikilink wikilink-missing" : "wikilink"}
            >
              {children}
            </a>
          );
        }
        return (
          <a href={href} {...props}>
            {children}
          </a>
        );
      },
    }),
    [wikiTargets, onOpenWikilink],
  );

  return (
    <section
      aria-label="HTML preview"
      className="min-w-0 flex-1 overflow-y-auto border-l border-line bg-bg"
    >
      <div className="prose prose-neutral prose-sm max-w-none px-7 py-6 dark:prose-invert prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-code:text-accent prose-pre:bg-hover prose-pre:text-ink prose-blockquote:border-l-accent prose-blockquote:text-muted prose-hr:border-line prose-th:border-line prose-td:border-line">
        {content.trim() ? (
          <Markdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={components}
          >
            {content}
          </Markdown>
        ) : (
          <p className="not-prose text-sm text-faint">Nothing to preview yet.</p>
        )}
      </div>
    </section>
  );
}
