import { useEffect, useMemo, useRef, useState } from "react";
import { FileText } from "lucide-react";
import type { FileEntry } from "../types";

/** A quick action shown above files in the palette. */
export interface Command {
  id: string;
  label: string;
  /** Right-aligned hint (e.g. a shortcut or context). */
  hint?: string;
  icon: React.ReactNode;
  /** Extra words to match against (besides the label). */
  keywords?: string;
  run: () => void;
}

interface QuickOpenProps {
  files: FileEntry[];
  commands: Command[];
  /** Open in the active tab. */
  onOpen: (path: string) => void;
  /** Open in a new tab (Ctrl/Cmd+Enter). */
  onOpenInNewTab: (path: string) => void;
  onClose: () => void;
}

const MAX_FILES = 50;

type Row =
  | { kind: "command"; cmd: Command }
  | { kind: "file"; file: FileEntry };

/** Ctrl/Cmd+P command palette: quick actions over a file search. Type to
 *  filter both; Enter runs the action / opens the file (Ctrl+Enter in a new
 *  tab); ↑/↓ to move, Esc to close. Reuses the modal-overlay pattern. */
export function QuickOpen({
  files,
  commands,
  onOpen,
  onOpenInNewTab,
  onClose,
}: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const candidates = useMemo(
    () =>
      files
        .filter((f) => !f.isDir)
        .sort((a, b) =>
          a.relPath.toLowerCase().localeCompare(b.relPath.toLowerCase()),
        ),
    [files],
  );

  const { rows, fileStart } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cmds = commands.filter(
      (c) =>
        q === "" ||
        c.label.toLowerCase().includes(q) ||
        (c.keywords ?? "").toLowerCase().includes(q),
    );
    const fs = (q === "" ? candidates : candidates.filter((f) => f.relPath.toLowerCase().includes(q))).slice(
      0,
      MAX_FILES,
    );
    const r: Row[] = [
      ...cmds.map((cmd) => ({ kind: "command" as const, cmd })),
      ...fs.map((file) => ({ kind: "file" as const, file })),
    ];
    return { rows: r, fileStart: cmds.length };
  }, [candidates, commands, query]);

  useEffect(() => setSel(0), [query]);

  // Keep the highlighted row in view as the selection moves.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-row="${sel}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [sel, rows.length]);

  function activate(row: Row | undefined, newTab: boolean) {
    if (!row) return;
    onClose();
    if (row.kind === "command") row.cmd.run();
    else if (newTab) onOpenInNewTab(row.file.path);
    else onOpen(row.file.path);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(rows[sel], e.ctrlKey || e.metaKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const rowClass = (i: number) =>
    `flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-sm ${
      i === sel ? "bg-accent/10 text-accent" : "text-ink hover:bg-hover"
    }`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-card shadow-popover"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder="Search actions and files…"
          aria-label="Search actions and files"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-faint"
        />
        <ul ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {rows.length === 0 ? (
            <li className="px-4 py-3 text-sm text-faint">No matches.</li>
          ) : (
            rows.map((row, i) => (
              <li key={row.kind === "command" ? `c:${row.cmd.id}` : `f:${row.file.path}`}>
                {i === 0 && row.kind === "command" && (
                  <p className="px-4 pb-0.5 pt-1 text-xs font-medium uppercase tracking-wide text-faint">
                    Actions
                  </p>
                )}
                {i === fileStart && row.kind === "file" && (
                  <p className="px-4 pb-0.5 pt-1 text-xs font-medium uppercase tracking-wide text-faint">
                    Files
                  </p>
                )}
                <button
                  type="button"
                  data-row={i}
                  onMouseMove={() => setSel(i)}
                  onClick={() => activate(row, false)}
                  className={rowClass(i)}
                >
                  {row.kind === "command" ? (
                    <>
                      <span className="shrink-0 text-faint">{row.cmd.icon}</span>
                      <span className="truncate">{row.cmd.label}</span>
                      {row.cmd.hint && (
                        <span className="ml-auto truncate pl-3 text-xs text-faint">
                          {row.cmd.hint}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <FileText size={14} className="shrink-0 text-faint" aria-hidden />
                      <span className="truncate">{row.file.name}</span>
                      <span className="ml-auto truncate pl-3 text-xs text-faint">
                        {row.file.relPath}
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
