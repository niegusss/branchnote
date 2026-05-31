import { useState } from "react";
import { AlertTriangle, ClipboardList, Plus, X } from "lucide-react";
import type { Spec, SpecStatus } from "../types";
import { SPEC_STATUSES, specProgressPct, statusMismatch } from "../lib/specs";
import { textInput } from "../lib/ui";

interface SpecsViewProps {
  specs: Spec[];
  /** Open a spec's `spec.md` in the editor. */
  onOpenSpec: (specPath: string) => void;
  /** Scaffold a new spec from a title. */
  onCreateSpec: (title: string) => void;
  /** Change a spec's status (human declaration). */
  onSetStatus: (spec: Spec, status: SpecStatus) => void;
  onClose: () => void;
}

/** Status pill colour — semantic, independent of progress. */
const statusClass: Record<SpecStatus, string> = {
  draft: "text-faint",
  active: "text-accent",
  done: "text-emerald-500 dark:text-emerald-400",
};

/** Main-area Specs explorer: specs are first-class objects (id, title, status,
 *  progress), not raw files. Create, open, and re-declare status here. */
export function SpecsView({
  specs,
  onOpenSpec,
  onCreateSpec,
  onSetStatus,
  onClose,
}: SpecsViewProps) {
  const [title, setTitle] = useState("");

  function commit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreateSpec(trimmed);
    setTitle("");
  }

  return (
    <section aria-label="Specs" className="flex min-w-0 flex-1 flex-col bg-bg">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <ClipboardList size={14} className="text-muted" aria-hidden />
          Specs
          <span className="ml-2 text-xs font-normal text-faint">
            {specs.length} {specs.length === 1 ? "spec" : "specs"}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Close specs"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
        >
          <X size={15} aria-hidden />
          <span className="sr-only">Close specs</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl p-6">
          {/* New spec */}
          <div className="mb-6 flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
              }}
              placeholder="New spec title (e.g. PDF export)"
              aria-label="New spec title"
              className={textInput}
            />
            <button
              type="button"
              onClick={commit}
              disabled={title.trim() === ""}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <Plus size={15} aria-hidden />
              New Spec
            </button>
          </div>

          {specs.length === 0 ? (
            <p className="py-12 text-center text-sm text-faint">
              No specs yet — create one to start.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {specs.map((spec) => {
                const pct = specProgressPct(spec.progress);
                const mismatch = statusMismatch(spec);
                return (
                  <li
                    key={spec.dirRelPath}
                    className="rounded-lg border border-line bg-card p-3 transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenSpec(spec.specPath)}
                        className="min-w-0 flex-1 text-left"
                        title={`Open ${spec.id}`}
                      >
                        <span className="font-mono text-xs text-faint">{spec.id}</span>
                        <span className="block truncate text-sm font-medium text-ink">
                          {spec.title}
                        </span>
                      </button>
                      {/* Status: a human declaration, set inline. */}
                      <select
                        value={spec.status}
                        onChange={(e) =>
                          onSetStatus(spec, e.currentTarget.value as SpecStatus)
                        }
                        aria-label={`Status of ${spec.id}`}
                        className={`shrink-0 cursor-pointer rounded-md border border-line bg-bg px-2 py-1 text-xs font-medium capitalize outline-none transition-colors hover:bg-hover focus:ring-2 focus:ring-accent/30 ${statusClass[spec.status]}`}
                      >
                        {SPEC_STATUSES.map((s) => (
                          <option key={s} value={s} className="text-ink">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Progress: a metric, independent of status. */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {spec.progress.done}/{spec.progress.total} · {pct}%
                      </span>
                    </div>

                    {mismatch && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle size={13} aria-hidden />
                        Marked done with {spec.progress.done}/{spec.progress.total} tasks complete.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
