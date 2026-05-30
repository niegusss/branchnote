import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { FileEntry } from "../types";

/**
 * Typed wrappers over the Tauri Rust core commands (see `src-tauri/src/fs.rs`,
 * `watcher.rs`). Tauri v2 maps JS camelCase args to Rust snake_case.
 */

/** Open the native folder picker. Returns the chosen path, or null if cancelled. */
export async function pickFolder(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false });
  return typeof result === "string" ? result : null;
}

/** Resolve (creating if needed) the default vault at Documents/Branchnote. */
export const defaultVault = () => invoke<string>("default_vault");

/** List markdown files and folders under `root`. */
export const listEntries = (root: string) =>
  invoke<FileEntry[]>("list_entries", { root });

export const readFile = (path: string) => invoke<string>("read_file", { path });

export const saveFile = (path: string, content: string) =>
  invoke<void>("save_file", { path, content });

/** Create a new markdown file in `dir`; returns its absolute path. */
export const createFile = (dir: string, name: string) =>
  invoke<string>("create_file", { dir, name });

/** Create a new folder in `dir`; returns its absolute path. */
export const createFolder = (dir: string, name: string) =>
  invoke<string>("create_folder", { dir, name });

/** Rename a file or folder in place; returns the new absolute path. */
export const renameEntry = (path: string, newName: string) =>
  invoke<string>("rename_entry", { path, newName });

export const deleteEntry = (path: string) =>
  invoke<void>("delete_entry", { path });

/** Move a file or folder into `destDir`; returns the new absolute path. */
export const moveEntry = (src: string, destDir: string) =>
  invoke<string>("move_entry", { src, destDir });

/** Start watching `root` for changes (replaces any previous watch). */
export const watchFolder = (root: string) =>
  invoke<void>("watch_folder", { root });

/** Subscribe to debounced workspace changes. Resolves to an unlisten function. */
export const onWorkspaceChanged = (cb: () => void): Promise<UnlistenFn> =>
  listen("workspace-changed", () => cb());
