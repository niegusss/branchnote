import { useEffect } from "react";
import { btnDanger, btnPrimary, btnSecondary } from "../lib/ui";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app confirmation modal for destructive actions (matches Settings styling). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-line bg-card shadow-popover"
      >
        <div className="px-4 py-4">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="mt-2 text-sm text-muted">{message}</p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" onClick={onCancel} className={btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={danger ? btnDanger : btnPrimary}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
