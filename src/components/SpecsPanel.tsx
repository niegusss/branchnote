import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
} from "lucide-react";
import type { FileEntry, Spec, SpecStatus } from "../types";
import { SPEC_STATUSES, specProgressPct, statusMismatch } from "../lib/specs";
import { textInput } from "../lib/ui";

interface SpecsPanelProps {
  specs: Spec[];
  /** Full workspace file list — used to list each spec folder's `.md` files. */
  files: FileEntry[];
  /** Currently-open file (for highlighting). */
  selectedPath: string | null;
  onOpenFile: (path: string) => void;
  onCreateSpec: (title: string) => void;
  onSetStatus: (spec: Spec, status: SpecStatus) => void;
}

/** Active-row treatment, matching the Sidebar. */
const ROW_ACTIVE = "bg-accent/10 text-accent";

/** Status pill colour — semantic, independent of progress. */
const statusClass: Record<SpecStatus, string> = {
  draft: "text-faint",
  active: "text-accent",
  done: "text-emerald-500 dark:text-emerald-400",
};

/** Canonical spec files first, then the rest alphabetically. */
const FILE_ORDER: Record<string, number> = { "spec.md": 0, "plan.md": 1, "tasks.md": 2 };
function fileRank(name: string): number {
  return FILE_ORDER[name.toLowerCase()] ?? 3;
}

/** Drop a trailing markdown extension for display. */
function stripMd(name: string): string {
  return name.replace(/\.(md|markdown)$/i, "");
}

/** Specs as primary navigation: a spec is the unit you browse. Expand a spec to
 *  its files (spec/plan/tasks), click to edit in the main area. */
export function SpecsPanel({
  specs,
  files,
  selectedPath,
  onOpenFile,
  onCreateSpec,
  onSetStatus,
}: SpecsPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  // Immediate `.md` children of each spec folder, keyed by the spec's dirRelPath.
  const filesBySpec = useMemo(() => {
    const map = new Map<string, FileEntry[]>();
    for (const spec of specs) {
      const prefix = spec.dirRelPath + "/";
      const kids = files
        .filter(
          (f) =>
            !f.isDir &&
            f.relPath.startsWith(prefix) &&
            !f.relPath.slice(prefix.length).includes("/"),
        )
        .sort((a, b) => fileRank(a.name) - fileRank(b.name) || a.name.localeCompare(b.name));
      map.set(spec.dirRelPath, kids);
    }
    return map;
  }, [specs, files]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openSpec(spec: Spec) {
    setExpanded((prev) => new Set(prev).add(spec.dirRelPath));
    onOpenFile(spec.specPath);
  }

  function commit() {
    const trimmed = title.trim();
    if (trimmed) onCreateSpec(trimmed);
    setTitle("");
    setCreating(false);
  }

  return (
    <aside
      aria-label="Specs"
      className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-panel"
    >
      <div className="flex items-center justify-between px-2 py-2.5 text-xs font-medium uppercase tracking-wide text-faint">
        <span className="px-1">Specs</span>
        <button
          type="button"
          onClick={() => {
            setCreating((v) => !v);
            setTitle("");
          }}
          title="New spec"
          aria-pressed={creating}
          className="rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
        >
          <Plus size={15} aria-hidden />
          <span className="sr-only">New spec</span>
        </button>
      </div>

      {creating && (
        <div className="px-2 pb-2">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setTitle("");
                setCreating(false);
              }
            }}
            placeholder="New spec title"
            aria-label="New spec title"
            className={textInput}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {specs.length === 0 ? (
          <p className="px-3 py-2 text-sm text-faint">No specs yet — create one to start.</p>
        ) : (
          <ul className="flex flex-col">
            {specs.map((spec) => {
              const isOpen = expanded.has(spec.dirRelPath);
              const pct = specProgressPct(spec.progress);
              const mismatch = statusMismatch(spec);
              const kids = filesBySpec.get(spec.dirRelPath) ?? [];
              return (
                <li key={spec.dirRelPath}>
                  <div className="flex items-center gap-0.5 px-1">
                    <button
                      type="button"
                      onClick={() => toggle(spec.dirRelPath)}
                      title={isOpen ? "Collapse" : "Expand"}
                      className="rounded p-0.5 text-faint transition-colors hover:bg-hover hover:text-ink"
                    >
                      {isOpen ? (
                        <ChevronDown size={14} aria-hidden />
                      ) : (
                        <ChevronRight size={14} aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openSpec(spec)}
                      title={`Open ${spec.id}`}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-hover active:scale-[0.99]"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-faint">{spec.id}</span>
                        {mismatch && (
                          <AlertTriangle
                            size={11}
                            className="text-amber-600 dark:text-amber-400"
                            aria-label="Marked done with tasks remaining"
                          />
                        )}
                      </span>
                      <span className="truncate text-sm text-ink">{spec.title}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-hover">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-faint">
                          {spec.progress.done}/{spec.progress.total}
                        </span>
                      </span>
                    </button>
                  </div>

                  {/* Status: a human declaration, independent of progress. */}
                  <div className="pl-7 pr-2 pb-1">
                    <select
                      value={spec.status}
                      onChange={(e) => onSetStatus(spec, e.currentTarget.value as SpecStatus)}
                      aria-label={`Status of ${spec.id}`}
                      className={`w-full cursor-pointer rounded border border-line bg-bg px-1.5 py-0.5 text-xs font-medium capitalize outline-none transition-colors hover:bg-hover focus:ring-2 focus:ring-accent/30 ${statusClass[spec.status]}`}
                    >
                      {SPEC_STATUSES.map((s) => (
                        <option key={s} value={s} className="text-ink">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isOpen && (
                    <ul className="ml-5 border-l border-line pl-1">
                      {kids.length === 0 ? (
                        <li className="px-2 py-1 text-xs text-faint">No files</li>
                      ) : (
                        kids.map((f) => (
                          <li key={f.path}>
                            <button
                              type="button"
                              onClick={() => onOpenFile(f.path)}
                              title={f.name}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors active:scale-[0.99] ${
                                f.path === selectedPath
                                  ? ROW_ACTIVE
                                  : "text-ink hover:bg-hover"
                              }`}
                            >
                              <FileText size={14} className="shrink-0 text-muted" aria-hidden />
                              <span className="truncate">{stripMd(f.name)}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
