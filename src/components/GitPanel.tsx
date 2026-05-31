import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  Minus,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { btnPrimary, iconButton, textInput } from "../lib/ui";
import { buildChangeTree, type ChangeNode } from "../lib/gitTree";
import type { CommitInfo, GitFileStatus, GitStatus } from "../types";

type Section = "staged" | "unstaged";

interface GitPanelProps {
  /** null while the first repo detection is in flight. */
  isRepo: boolean | null;
  status: GitStatus | null;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  log: CommitInfo[];
  loading: boolean;
  /** Which sync action is in flight (per-button progress labels). */
  busy: "push" | "pull" | null;
  /** Whether an `origin` remote is configured (gates the sync controls). */
  hasRemote: boolean;
  error: string | null;
  /** Advisory message needing user action (e.g. a diverged pull). */
  warn: string | null;
  /** Transient success/info message (e.g. pull outcome). */
  notice: string | null;
  onInit: () => void;
  onRefresh: () => void;
  onPull: () => void;
  onPush: () => void;
  /** Open a changed file in the editor (by vault-relative path). */
  onOpenFile: (relPath: string) => void;
  onStage: (relPath: string) => void;
  onUnstage: (relPath: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  /** Commit the staged set; resolves true on success (so the box can clear). */
  onCommit: (message: string) => Promise<boolean>;
}

/** Single-letter badge + tint per change kind, kept within the design tokens. */
const STATUS_BADGE: Record<GitFileStatus["status"], { letter: string; cls: string }> = {
  new: { letter: "U", cls: "text-accent" },
  modified: { letter: "M", cls: "text-accent" },
  deleted: { letter: "D", cls: "text-danger" },
  renamed: { letter: "R", cls: "text-muted" },
  typechange: { letter: "T", cls: "text-muted" },
  conflicted: { letter: "!", cls: "text-danger" },
};

/** Coarse "x ago" from a Unix timestamp (seconds). */
function relTime(seconds: number): string {
  const diff = Date.now() / 1000 - seconds;
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const sectionLabel = "text-xs font-medium uppercase tracking-wide text-faint";

/**
 * Source-control panel: a commit box, the working tree split into Staged /
 * Changes (each a collapsible folder tree with per-file + bulk stage/unstage),
 * and History. Read-only until a repo exists (Initialize prompt). Git stays
 * visible and explicit — no fake realtime sync (see productContext).
 */
export function GitPanel({
  isRepo,
  status,
  staged,
  unstaged,
  log,
  loading,
  busy,
  hasRemote,
  error,
  warn,
  notice,
  onInit,
  onRefresh,
  onPull,
  onPush,
  onOpenFile,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
  onCommit,
}: GitPanelProps) {
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  // Collapsed folder paths, keyed by `${section}:${relPath}` so the two trees
  // collapse independently. Default = all expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function commit() {
    if (!message.trim() || staged.length === 0 || committing) return;
    setCommitting(true);
    const ok = await onCommit(message);
    setCommitting(false);
    if (ok) setMessage("");
  }

  /** Recursively render a node of one section's change tree. */
  function renderNode(node: ChangeNode, section: Section): React.ReactNode {
    if (node.isDir) {
      const key = `${section}:${node.relPath}`;
      const isCollapsed = collapsed.has(key);
      return (
        <li key={key}>
          <button
            type="button"
            onClick={() => toggle(key)}
            title={node.relPath}
            className="flex w-full min-w-0 items-center gap-1 rounded-md px-3 py-1 text-left text-sm text-ink transition-colors hover:bg-hover active:scale-[0.99]"
          >
            {isCollapsed ? (
              <ChevronRight size={14} className="shrink-0 text-faint" aria-hidden />
            ) : (
              <ChevronDown size={14} className="shrink-0 text-faint" aria-hidden />
            )}
            {isCollapsed ? (
              <Folder size={14} className="shrink-0 text-faint" aria-hidden />
            ) : (
              <FolderOpen size={14} className="shrink-0 text-faint" aria-hidden />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {!isCollapsed && (
            <ul className="ml-3 border-l border-line pl-2">
              {node.children.map((child) => renderNode(child, section))}
            </ul>
          )}
        </li>
      );
    }

    const badge = STATUS_BADGE[node.status ?? "modified"];
    const isDeleted = node.status === "deleted";
    const ActionIcon = section === "unstaged" ? Plus : Minus;
    const actionTitle = section === "unstaged" ? "Stage" : "Unstage";
    const onAction = section === "unstaged" ? onStage : onUnstage;

    const nameSpan = (
      <span className={`truncate ${isDeleted ? "line-through" : ""}`}>{node.name}</span>
    );
    const badgeSpan = (
      <span
        className={`w-3 shrink-0 text-center font-mono text-xs font-semibold ${badge.cls}`}
        aria-hidden
      >
        {badge.letter}
      </span>
    );

    return (
      <li key={`${section}:${node.relPath}`}>
        <div className="group flex items-center rounded-md pr-1 text-sm transition-colors hover:bg-hover">
          {isDeleted ? (
            <span
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1 text-muted"
              title={`${node.status}: ${node.relPath}`}
            >
              {badgeSpan}
              {nameSpan}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onOpenFile(node.relPath)}
              title={`${node.status}: ${node.relPath}`}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1 text-left text-ink active:scale-[0.99]"
            >
              {badgeSpan}
              {nameSpan}
            </button>
          )}
          <button
            type="button"
            onClick={() => onAction(node.relPath)}
            title={actionTitle}
            className="shrink-0 rounded p-1 text-faint transition-colors hover:bg-hover hover:text-ink"
          >
            <ActionIcon size={14} aria-hidden />
            <span className="sr-only">{actionTitle}</span>
          </button>
        </div>
      </li>
    );
  }

  function renderSection(
    title: string,
    items: GitFileStatus[],
    section: Section,
    onAll: () => void,
    AllIcon: typeof Plus,
    allTitle: string,
  ) {
    return (
      <>
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <h2 className={sectionLabel}>
            {title}
            {items.length > 0 ? ` (${items.length})` : ""}
          </h2>
          {items.length > 0 && (
            <button type="button" onClick={onAll} title={allTitle} className={iconButton}>
              <AllIcon size={14} aria-hidden />
              <span className="sr-only">{allTitle}</span>
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-1 text-sm text-faint">None</p>
        ) : (
          <ul className="px-1.5">{buildChangeTree(items).map((n) => renderNode(n, section))}</ul>
        )}
      </>
    );
  }

  const canCommit = message.trim().length > 0 && staged.length > 0 && !committing;

  // Sync state (ahead/behind are null until a tracking ref exists).
  const ahead = status?.ahead ?? null;
  const behind = status?.behind ?? null;
  const canPull = hasRemote && busy === null && (behind === null || behind > 0);
  const canPush = hasRemote && busy === null && (ahead === null || ahead > 0);
  const pullTitle = !hasRemote
    ? "Set a remote in Settings to sync"
    : behind && behind > 0
      ? `Pull (${behind} behind)`
      : "Pull (up to date)";
  const pushTitle = !hasRemote
    ? "Set a remote in Settings to sync"
    : ahead && ahead > 0
      ? `Push (${ahead} to push)`
      : "Push (nothing to push)";

  return (
    <aside
      className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-panel"
      aria-label="Source control"
    >
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <GitBranch size={14} className="text-muted" aria-hidden />
          {isRepo && status ? status.branch : "Source control"}
        </span>
        {isRepo && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onPull}
              disabled={!canPull}
              title={pullTitle}
              className={iconButton}
            >
              {busy === "pull" ? (
                <RefreshCw size={14} className="animate-spin" aria-hidden />
              ) : (
                <Download size={14} aria-hidden />
              )}
              <span className="sr-only">Pull</span>
            </button>
            <button
              type="button"
              onClick={onPush}
              disabled={!canPush}
              title={pushTitle}
              className={iconButton}
            >
              {busy === "push" ? (
                <RefreshCw size={14} className="animate-spin" aria-hidden />
              ) : (
                <Upload size={14} aria-hidden />
              )}
              <span className="sr-only">Push</span>
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh"
              className={iconButton}
            >
              <RefreshCw
                size={14}
                className={loading ? "animate-spin" : undefined}
                aria-hidden
              />
              <span className="sr-only">Refresh</span>
            </button>
          </div>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="border-b border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      )}
      {warn && !error && (
        <p
          role="status"
          className="border-b border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400"
        >
          {warn}
        </p>
      )}
      {notice && !error && !warn && (
        <p className="border-b border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
          {notice}
        </p>
      )}

      {isRepo === null ? (
        <p className="px-3 py-4 text-sm text-muted">Loading…</p>
      ) : isRepo === false ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <GitBranch className="text-faint" size={36} aria-hidden />
          <p className="text-sm text-muted">
            This vault is not a git repository yet.
          </p>
          <button type="button" onClick={onInit} disabled={loading} className={btnPrimary}>
            Initialize repository
          </button>
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-line p-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.currentTarget.value)}
              onKeyDown={(e) => {
                // Ctrl/Cmd+Enter commits.
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                }
              }}
              rows={2}
              placeholder="Commit message (Ctrl+Enter)"
              className={`${textInput} resize-none`}
            />
            <button
              type="button"
              onClick={() => void commit()}
              disabled={!canCommit}
              className={`${btnPrimary} mt-2 w-full`}
            >
              {committing ? "Committing…" : "Commit"}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {renderSection("Staged Changes", staged, "staged", onUnstageAll, Minus, "Unstage all")}
            {renderSection("Changes", unstaged, "unstaged", onStageAll, Plus, "Stage all")}

            <h2 className={`${sectionLabel} px-3 pt-3 pb-1`}>History</h2>
            {log.length === 0 ? (
              <p className="px-3 py-1 text-sm text-faint">No commits yet</p>
            ) : (
              <ul>
                {log.map((c) => (
                  <li key={c.id} className="px-3 py-1.5">
                    <p className="flex items-center gap-2 text-sm text-ink">
                      <GitCommitHorizontal size={14} className="shrink-0 text-faint" aria-hidden />
                      <span className="truncate">{c.summary || "(no message)"}</span>
                    </p>
                    <p className="pl-6 text-xs text-faint">
                      {c.author} · {relTime(c.time)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
