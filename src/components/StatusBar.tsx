import { GitBranch } from "lucide-react";
import type { GitStatus } from "../types";

interface StatusBarProps {
  git: GitStatus;
  dirty: boolean;
}

/**
 * Bottom status bar. Git is intentionally visible (not hidden behind fake
 * "realtime sync"). Values are stubbed until the Tauri core wires up libgit2.
 */
export function StatusBar({ git, dirty }: StatusBarProps) {
  const changeLabel = git.clean
    ? "no changes"
    : `${git.changedFiles} changed`;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <GitBranch size={12} className="text-faint" aria-hidden />
        {git.branch}
      </span>
      <span>{changeLabel}</span>
      <span className={`ml-auto ${dirty ? "text-accent" : "text-faint"}`}>
        {dirty ? "Unsaved edits" : "Saved"}
      </span>
    </footer>
  );
}
