/**
 * Shared domain types for the Branchnote frontend.
 * These mirror what the Tauri Rust core returns over IPC.
 */

/** A markdown file or folder discovered in the open workspace folder. */
export interface FileEntry {
  /** Absolute path on disk. */
  path: string;
  /** Display name, e.g. "ideas.md" or "notes". */
  name: string;
  /** Path relative to the workspace root, e.g. "notes/ideas.md". */
  relPath: string;
  /** True for directories. */
  isDir: boolean;
}

/** Git working-tree summary surfaced in the status bar (stubbed until the git core lands). */
export interface GitStatus {
  branch: string;
  /** Number of files with uncommitted changes. */
  changedFiles: number;
  /** True when the working tree has no changes. */
  clean: boolean;
}
