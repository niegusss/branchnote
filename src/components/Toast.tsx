import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";

export type ToastKind = "error" | "warn" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastHostProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

/** How long an `info` toast stays before auto-dismissing. */
const INFO_TTL_MS = 4000;

// Solid (opaque) cards: a `bg-card` base with a colored left accent + icon, so
// notifications read clearly over the editor instead of letting it show through.
const KIND: Record<
  ToastKind,
  { cls: string; iconCls: string; role: string; Icon: typeof XCircle }
> = {
  error: {
    cls: "border-line border-l-2 border-l-danger bg-card text-ink",
    iconCls: "text-danger",
    role: "alert",
    Icon: XCircle,
  },
  warn: {
    cls: "border-line border-l-2 border-l-amber-500 bg-card text-ink",
    iconCls: "text-amber-600 dark:text-amber-400",
    role: "alert",
    Icon: AlertTriangle,
  },
  info: {
    cls: "border-line border-l-2 border-l-accent bg-card text-ink",
    iconCls: "text-accent",
    role: "status",
    Icon: CheckCircle2,
  },
};

/** A single toast card; `info` toasts self-dismiss after a short delay. */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { id, kind, message } = toast;
  const { cls, iconCls, role, Icon } = KIND[kind];

  useEffect(() => {
    if (kind !== "info") return;
    const t = setTimeout(() => onDismiss(id), INFO_TTL_MS);
    return () => clearTimeout(t);
  }, [id, kind, onDismiss]);

  return (
    <div
      role={role}
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-popover ${cls}`}
    >
      <Icon size={15} className={`mt-0.5 shrink-0 ${iconCls}`} aria-hidden />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        title="Dismiss"
        className="-mr-1 shrink-0 rounded p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
      >
        <X size={14} aria-hidden />
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}

/** Bottom-right stack of dismissable notifications (errors/warnings/info). */
export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
