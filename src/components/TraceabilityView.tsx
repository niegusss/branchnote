import { useMemo } from "react";
import { GitCommitHorizontal, Waypoints, X } from "lucide-react";
import type { Spec, SpecCommit, SpecStatus } from "../types";
import { specProgressPct } from "../lib/specs";
import { relTime } from "../lib/format";

interface TraceabilityViewProps {
  specs: Spec[];
  commits: SpecCommit[];
  /** Open a spec's `spec.md` in the editor. */
  onOpenSpec: (specPath: string) => void;
  onClose: () => void;
}

/** Status pill colour — matches SpecsPanel. */
const statusClass: Record<SpecStatus, string> = {
  draft: "text-faint",
  active: "text-accent",
  done: "text-emerald-500 dark:text-emerald-400",
};

/** Traceability: which commits realize which spec/task. Commits are linked by a
 *  `SPEC-NNN` / `Txxx` reference in their message (see the handoff convention). */
export function TraceabilityView({
  specs,
  commits,
  onOpenSpec,
  onClose,
}: TraceabilityViewProps) {
  const bySpec = useMemo(() => {
    const map = new Map<string, SpecCommit[]>();
    for (const c of commits) {
      const arr = map.get(c.specId);
      if (arr) arr.push(c);
      else map.set(c.specId, [c]);
    }
    return map;
  }, [commits]);

  // Specs in id order, plus any referenced spec ids that no longer exist (orphans).
  const knownIds = new Set(specs.map((s) => s.id));
  const orphanIds = [...bySpec.keys()].filter((id) => !knownIds.has(id)).sort();
  const orderedSpecs = [...specs].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <section aria-label="Traceability" className="flex min-w-0 flex-1 flex-col bg-bg">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Waypoints size={14} className="text-muted" aria-hidden />
          Traceability
          <span className="ml-2 text-xs font-normal text-faint">
            {commits.length} linked {commits.length === 1 ? "commit" : "commits"}
          </span>
        </span>
        <button
          type="button"
          onClick={onClose}
          title="Close traceability"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
        >
          <X size={15} aria-hidden />
          <span className="sr-only">Close traceability</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl p-6">
          {orderedSpecs.length === 0 && orphanIds.length === 0 ? (
            <p className="py-12 text-center text-sm text-faint">No specs yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {orderedSpecs.map((spec) => (
                <li key={spec.dirRelPath} className="rounded-lg border border-line bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenSpec(spec.specPath)}
                      className="flex min-w-0 items-baseline gap-2 text-left"
                      title={`Open ${spec.id}`}
                    >
                      <span className="font-mono text-xs text-faint">{spec.id}</span>
                      <span className="truncate text-sm font-medium text-ink">{spec.title}</span>
                    </button>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`text-xs font-medium capitalize ${statusClass[spec.status]}`}>
                        {spec.status}
                      </span>
                      <span className="text-xs tabular-nums text-faint">
                        {spec.progress.done}/{spec.progress.total} · {specProgressPct(spec.progress)}%
                      </span>
                    </span>
                  </div>
                  <CommitList commits={bySpec.get(spec.id) ?? []} />
                </li>
              ))}

              {orphanIds.map((id) => (
                <li key={id} className="rounded-lg border border-line bg-card p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-faint">{id}</span>
                    <span className="text-xs italic text-faint">(no matching spec)</span>
                  </div>
                  <CommitList commits={bySpec.get(id) ?? []} />
                </li>
              ))}
            </ul>
          )}

          <p className="mt-6 text-center text-xs text-faint">
            Commits link by a <code className="text-muted">SPEC-001 T003:</code> reference in
            their message.
          </p>
        </div>
      </div>
    </section>
  );
}

function CommitList({ commits }: { commits: SpecCommit[] }) {
  if (commits.length === 0) {
    return <p className="mt-2 text-xs text-faint">No linked commits yet.</p>;
  }
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {commits.map((c) => (
        <li key={c.id} className="flex items-start gap-2 text-sm">
          <GitCommitHorizontal size={14} className="mt-0.5 shrink-0 text-muted" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="truncate text-ink">{c.summary}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] text-faint">{c.shortId}</span>
              {c.tasks.map((t) => (
                <span
                  key={t}
                  className="rounded bg-accent/10 px-1 font-mono text-[10px] text-accent"
                >
                  {t}
                </span>
              ))}
              <span className="text-[10px] text-faint">{relTime(c.time)}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
