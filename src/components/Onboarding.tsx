import { FolderOpen, FolderPlus } from "lucide-react";
import { btnPrimary, btnSecondary } from "../lib/ui";

interface OnboardingProps {
  onChooseFolder: () => void;
  onUseDefault: () => void;
  busy: boolean;
  error: string | null;
}

/** First-run welcome: pick a vault folder, or create/use the default one. */
export function Onboarding({ onChooseFolder, onUseDefault, busy, error }: OnboardingProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-bg px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Welcome to Branchnote
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        A minimal, local-first markdown workspace. Choose a vault — a folder of
        markdown files that you own — to get started.
      </p>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onChooseFolder} disabled={busy} className={btnPrimary}>
          <FolderOpen size={16} aria-hidden />
          Choose a folder
        </button>
        <button
          type="button"
          onClick={onUseDefault}
          disabled={busy}
          className={`${btnSecondary} px-4 py-2`}
        >
          <FolderPlus size={16} aria-hidden />
          Use the default vault
        </button>
      </div>

      <p className="mt-3 text-xs text-faint">
        The default vault is created at Documents/Branchnote.
      </p>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}
