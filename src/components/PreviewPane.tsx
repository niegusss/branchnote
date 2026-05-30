import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface PreviewPaneProps {
  content: string;
}

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize];

/**
 * Rendered HTML preview. remark-gfm enables tables/task-lists; rehype-sanitize
 * strips unsafe HTML before render (note content is untrusted).
 */
export function PreviewPane({ content }: PreviewPaneProps) {
  return (
    <section
      aria-label="HTML preview"
      className="min-w-0 flex-1 overflow-y-auto border-l border-line bg-bg"
    >
      <div className="prose prose-neutral prose-sm max-w-none px-7 py-6 dark:prose-invert prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-code:text-accent prose-pre:bg-hover prose-pre:text-ink prose-blockquote:border-l-accent prose-blockquote:text-muted prose-hr:border-line prose-th:border-line prose-td:border-line">
        {content.trim() ? (
          <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
            {content}
          </Markdown>
        ) : (
          <p className="not-prose text-sm text-faint">Nothing to preview yet.</p>
        )}
      </div>
    </section>
  );
}
