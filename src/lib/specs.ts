/** Derived (UI-only) helpers over specs. The engine stays the source of truth;
 *  these never mutate, they only project facts the backend already returned. */
import type { Spec, SpecProgress } from "../types";

export const SPEC_STATUSES = ["draft", "active", "done"] as const;

/** Completed-task percentage (0 when there are no tasks). */
export function specProgressPct(p: SpecProgress): number {
  return p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);
}

/** Soft, non-blocking inconsistency: marked `done` while tasks remain open.
 *  Status and progress are independent by design — this is only a warning. */
export function statusMismatch(spec: Spec): boolean {
  return spec.status === "done" && spec.progress.total > 0 && spec.progress.done < spec.progress.total;
}

/** Today as an ISO `YYYY-MM-DD` string (local date), passed to the Rust core. */
export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
