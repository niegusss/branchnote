import { useEffect } from "react";
import { Monitor, Moon, Sun, X } from "lucide-react";
import type { Theme } from "../lib/theme";
import { btnSecondary } from "../lib/ui";

interface SettingsProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  vaultPath: string | null;
  onChangeVault: () => void;
  onClose: () => void;
}

const THEME_OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/** Settings modal: appearance (theme) and vault. Extensible for git/AI later. */
export function Settings({
  theme,
  onThemeChange,
  vaultPath,
  onChangeVault,
  onClose,
}: SettingsProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-xl border border-line bg-card shadow-popover"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
          >
            <X size={16} aria-hidden />
            <span className="sr-only">Close settings</span>
          </button>
        </header>

        <div className="space-y-6 px-4 py-4">
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
              Appearance
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {THEME_OPTIONS.map(({ value, label, Icon }) => {
                const selected = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onThemeChange(value)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-sm transition-colors active:scale-[0.98] ${
                      selected
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-line text-muted hover:bg-hover hover:text-ink"
                    }`}
                  >
                    <Icon size={18} aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
              Vault
            </h3>
            <p className="mb-2 truncate text-sm text-muted" title={vaultPath ?? ""}>
              {vaultPath ?? "No vault open"}
            </p>
            <button type="button" onClick={onChangeVault} className={btnSecondary}>
              Change vault…
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
