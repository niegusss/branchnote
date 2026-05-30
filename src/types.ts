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

/** Git working-tree summary surfaced in the status bar. Mirrors Rust `GitStatus`. */
export interface GitStatus {
  branch: string;
  /** Number of files with uncommitted changes. */
  changedFiles: number;
  /** True when the working tree has no changes. */
  clean: boolean;
}

/** A single changed path in the Git panel's "Changes" list. Mirrors Rust `GitFileStatus`. */
export interface GitFileStatus {
  /** Path relative to the repo root, forward-slashed. */
  relPath: string;
  /** Coarse change kind. */
  status: "new" | "modified" | "deleted" | "renamed" | "typechange" | "conflicted";
}

/** Git author identity (from git config). Mirrors Rust `Identity`. */
export interface Identity {
  name: string;
  email: string;
}

/** Working tree split into staged + unstaged changes. Mirrors Rust `WorkingTree`. */
export interface WorkingTree {
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
}

/** GitHub OAuth device-flow handshake info. Mirrors Rust `DeviceCodeInfo`. */
export interface DeviceCodeInfo {
  /** Opaque code the app polls with (not shown to the user). */
  deviceCode: string;
  /** Short code the user types at the verification URL. */
  userCode: string;
  /** Where the user enters the code (github.com/login/device). */
  verificationUri: string;
  /** Minimum seconds between polls. */
  interval: number;
  /** Seconds until the codes expire. */
  expiresIn: number;
}

/** A single commit in the Git panel's "History" list. Mirrors Rust `CommitInfo`. */
export interface CommitInfo {
  /** Full commit hash. */
  id: string;
  /** First line of the commit message. */
  summary: string;
  /** Author name. */
  author: string;
  /** Author time, seconds since the Unix epoch. */
  time: number;
}
