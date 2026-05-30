import { useEffect, useRef, useState } from "react";
import { FileText, LayoutTemplate } from "lucide-react";
import type { FileEntry } from "../types";
import { readFile } from "../lib/workspace";
import { BUILT_IN_TEMPLATES } from "../lib/templates";

interface TemplatePickerProps {
  /** User templates: `.md` files in the vault's `templates/` folder. */
  templateFiles: FileEntry[];
  /** Called with the chosen template's raw body (placeholders not yet applied). */
  onPick: (rawBody: string) => void;
  triggerClassName: string;
  triggerContent: React.ReactNode;
  triggerTitle?: string;
}

const POPOVER_W = 224;

/** "New from template" trigger + popover. Lists built-in templates and the
 * user's own `templates/` files; resolves the body (reading the file if needed)
 * and hands it to `onPick`. */
export function TemplatePicker({
  templateFiles,
  onPick,
  triggerClassName,
  triggerContent,
  triggerTitle,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setAnchor(e.currentTarget.getBoundingClientRect());
    setOpen((v) => !v);
  }

  async function pick(body: string | Promise<string>) {
    setOpen(false);
    onPick(await body);
  }

  const left = anchor
    ? Math.max(4, Math.min(anchor.left, window.innerWidth - POPOVER_W - 4))
    : 0;
  const top = anchor ? anchor.bottom + 4 : 0;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      {open && anchor && (
        <ul
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ left, top, width: POPOVER_W }}
          className="fixed z-50 max-h-80 overflow-y-auto rounded-lg border border-line bg-card py-1 text-sm shadow-popover"
        >
          <li className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-faint">
            Templates
          </li>
          {BUILT_IN_TEMPLATES.map((t) => (
            <li key={`builtin:${t.name}`} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => void pick(t.body)}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-ink transition-colors hover:bg-hover active:scale-[0.99]"
              >
                <LayoutTemplate size={14} className="shrink-0 text-faint" aria-hidden />
                <span className="truncate">{t.name}</span>
              </button>
            </li>
          ))}
          {templateFiles.length > 0 && (
            <>
              <li className="mt-1 border-t border-line px-3 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-faint">
                From templates/
              </li>
              {templateFiles.map((f) => (
                <li key={f.path} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void pick(readFile(f.path))}
                    title={f.relPath}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-ink transition-colors hover:bg-hover active:scale-[0.99]"
                  >
                    <FileText size={14} className="shrink-0 text-faint" aria-hidden />
                    <span className="truncate">{f.name.replace(/\.(md|markdown)$/i, "")}</span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </>
  );
}
