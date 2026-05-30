import { invoke } from "@tauri-apps/api/core";
import type {
  CommitInfo,
  DeviceCodeInfo,
  GitStatus,
  Identity,
  WorkingTree,
} from "../types";

/**
 * Typed wrappers over the Tauri Rust git commands (see `src-tauri/src/git.rs`).
 * Read path: detect / init / status / worktree / log. Write path: stage /
 * unstage (per-path and all) + commit. Pull and push arrive in a later
 * increment. Tauri v2 maps JS camelCase args to Rust snake_case.
 */

/** True if `path` is the working directory of a git repository. */
export const gitIsRepo = (path: string) =>
  invoke<boolean>("git_is_repo", { path });

/** Initialise a new git repository at `path`. */
export const gitInit = (path: string) => invoke<void>("git_init", { path });

/** Branch + change-count summary for the status bar. */
export const gitStatus = (path: string) =>
  invoke<GitStatus>("git_status", { path });

/** Staged + unstaged changes for the Git panel. */
export const gitWorktree = (path: string) =>
  invoke<WorkingTree>("git_worktree", { path });

/** Most recent commits, newest first, up to `limit`. */
export const gitLog = (path: string, limit: number) =>
  invoke<CommitInfo[]>("git_log", { path, limit });

/** Stage a single path (add / modify / delete). */
export const gitStage = (path: string, relPath: string) =>
  invoke<void>("git_stage", { path, relPath });

/** Unstage a single path (reset its index entry to HEAD). */
export const gitUnstage = (path: string, relPath: string) =>
  invoke<void>("git_unstage", { path, relPath });

/** Stage every change (git add -A). */
export const gitStageAll = (path: string) =>
  invoke<void>("git_stage_all", { path });

/** Unstage everything (reset the index to HEAD). */
export const gitUnstageAll = (path: string) =>
  invoke<void>("git_unstage_all", { path });

/** Commit the currently staged set with `message`. */
export const gitCommit = (path: string, message: string) =>
  invoke<void>("git_commit", { path, message });

/** The `origin` remote URL, or null if none is configured. */
export const gitGetRemote = (path: string) =>
  invoke<string | null>("git_get_remote", { path });

/** Create or update the `origin` remote URL. */
export const gitSetRemote = (path: string, url: string) =>
  invoke<void>("git_set_remote", { path, url });

/** Read git `user.name` / `user.email`. */
export const gitGetIdentity = (path: string) =>
  invoke<Identity>("git_get_identity", { path });

/** Write git `user.name` / `user.email` (repo-local config). */
export const gitSetIdentity = (path: string, name: string, email: string) =>
  invoke<void>("git_set_identity", { path, name, email });

/** Store the HTTPS `{username, token}` credential in the OS keychain. */
export const gitSetHttpsAuth = (username: string, token: string) =>
  invoke<void>("git_set_https_auth", { username, token });

/** True if an HTTPS token is stored. */
export const gitHasHttpsAuth = () => invoke<boolean>("git_has_https_auth");

/** Remove the stored HTTPS token. */
export const gitClearHttpsAuth = () => invoke<void>("git_clear_https_auth");

/** Stored HTTPS account name for a "Signed in as …" label, or null. */
export const gitHttpsAccount = () =>
  invoke<string | null>("git_https_account");

/** Push the current branch to `origin`. */
export const gitPush = (path: string) => invoke<void>("git_push", { path });

/** Fetch + fast-forward; resolves to "up-to-date" | "fast-forward" | "diverged". */
export const gitPull = (path: string) => invoke<string>("git_pull", { path });

/** Authenticated handshake with `origin` — validates remote URL + credentials
 * for whichever scheme it uses (SSH or HTTPS). Rejects on failure. */
export const gitTestRemote = (path: string) =>
  invoke<void>("git_test_remote", { path });

/** Start the GitHub OAuth device flow: returns the user code + verification URL. */
export const githubDeviceStart = () =>
  invoke<DeviceCodeInfo>("github_device_start");

/** Poll once for the device-flow token; resolves to
 * "authorized" | "pending" | "slow_down" (token is stored on "authorized"). */
export const githubDevicePoll = (deviceCode: string) =>
  invoke<string>("github_device_poll", { deviceCode });
