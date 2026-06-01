import { useEffect, useRef, useState } from "react";
import { Check, FolderGit2, FolderOpen } from "lucide-react";
import { focusFirstItem, menuKeyDown } from "../lib/menuNav";

interface ProjectSwitcherProps {
  /** Absolute path of the current project (vault), or null. */
  current: string | null;
  /** Recently-opened project paths, most-recent-first. */
  recents: string[];
  /** Open one of the recent projects. */
  onOpenProject: (path: string) => void;
  /** Open the folder picker to choose a (possibly new) project. */
  onPickProject: () => void;
  triggerClassName: string;
  triggerContent: React.ReactNode;
  triggerTitle?: string;
}

const POPOVER_W = 280;

/** Last path segment, for display (handles `/` and `\\`). */
function baseName(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

/**
 * "Project" switcher: a vault *is* a project (its own folder/git repo). Lists
 * recently-opened projects and an "Open project…" picker. Mirrors the
 * TemplatePicker popover idiom.
 */
export function ProjectSwitcher({
  current,
  recents,
  onOpenProject,
  onPickProject,
  triggerClassName,
  triggerContent,
  triggerTitle,
}: ProjectSwitcherProps) {
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

  // Return focus to the trigger when the popover closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) btnRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setAnchor(e.currentTarget.getBoundingClientRect());
    setOpen((v) => !v);
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
          ref={focusFirstItem}
          role="menu"
          aria-label="Switch project"
          onKeyDown={menuKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={{ left, top, width: POPOVER_W }}
          className="fixed z-50 max-h-80 overflow-y-auto rounded-lg border border-line bg-card py-1 text-sm shadow-popover"
        >
          <li
            role="presentation"
            className="px-3 pb-1 pt-1 text-xs font-medium uppercase tracking-wide text-faint"
          >
            Recent projects
          </li>
          {recents.length === 0 ? (
            <li role="presentation" className="px-3 py-1.5 text-xs text-faint">
              No recent projects yet.
            </li>
          ) : (
            recents.map((path) => {
              const isCurrent = path === current;
              return (
                <li key={path} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      if (!isCurrent) onOpenProject(path);
                    }}
                    title={path}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-ink transition-colors hover:bg-hover active:scale-[0.99]"
                  >
                    <FolderGit2 size={14} className="shrink-0 text-faint" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{baseName(path)}</span>
                      <span className="truncate text-[11px] text-faint">{path}</span>
                    </span>
                    {isCurrent && (
                      <Check size={14} className="ml-auto shrink-0 text-accent" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })
          )}
          <li role="none" className="mt-1 border-t border-line pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPickProject();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-accent transition-colors hover:bg-accent/10 active:scale-[0.99]"
            >
              <FolderOpen size={14} className="shrink-0" aria-hidden />
              <span>Open project…</span>
            </button>
          </li>
        </ul>
      )}
    </>
  );
}
