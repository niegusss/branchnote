import { ArrowDown, ArrowUp, GitBranch } from "lucide-react";
import type { GitStatus } from "../types";

interface StatusBarProps {
  git: GitStatus;
  dirty: boolean;
}

/**
 * Bottom status bar. Git is intentionally visible (not hidden behind fake
 * "realtime sync") — branch, ahead/behind, and uncommitted change count.
 */
export function StatusBar({ git, dirty }: StatusBarProps) {
  const changeLabel = git.clean
    ? "no changes"
    : `${git.changedFiles} changed`;
  const ahead = git.ahead ?? 0;
  const behind = git.behind ?? 0;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-panel px-3 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <GitBranch size={12} className="text-faint" aria-hidden />
        {git.branch}
        {(ahead > 0 || behind > 0) && (
          <span className="flex items-center gap-1.5 text-faint">
            {ahead > 0 && (
              <span className="flex items-center" title={`${ahead} to push`}>
                <ArrowUp size={11} aria-hidden />
                {ahead}
              </span>
            )}
            {behind > 0 && (
              <span className="flex items-center" title={`${behind} to pull`}>
                <ArrowDown size={11} aria-hidden />
                {behind}
              </span>
            )}
          </span>
        )}
      </span>
      <span>{changeLabel}</span>
      <span className={`ml-auto ${dirty ? "text-accent" : "text-faint"}`}>
        {dirty ? "Unsaved edits" : "Saved"}
      </span>
    </footer>
  );
}
