import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { FileEntry, HandoffResult, NoteLinks, Spec, SpecStatus } from "../types";

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

/** Scan every note under `root` for `[[wikilink]]` targets (for the graph). */
export const scanLinks = (root: string) =>
  invoke<NoteLinks[]>("scan_links", { root });

/** Open the OS terminal in `path` (to run an external AI agent on the vault). */
export const openTerminal = (path: string) =>
  invoke<void>("open_terminal", { path });

/** Reveal `path` in the OS file manager (Explorer/Finder), selecting it if possible. */
export const revealPath = (path: string) =>
  invoke<void>("reveal_path", { path });

/** Scaffold a new spec folder under `<root>/specs/`; `today` is ISO YYYY-MM-DD. */
export const createSpec = (root: string, title: string, today: string) =>
  invoke<Spec>("create_spec", { root, title, today });

/** Project every `specs/SPEC-NNN-*` folder under `root` to a list of specs. */
export const scanSpecs = (root: string) => invoke<Spec[]>("scan_specs", { root });

/** Set a spec's status by rewriting its `spec.md` frontmatter. */
export const setSpecStatus = (specPath: string, status: SpecStatus, today: string) =>
  invoke<void>("set_status", { specPath, status, today });

/** Compose + write `handoff.md` for a spec; returns its path and the prompt text. */
export const writeHandoff = (root: string, dirRelPath: string) =>
  invoke<HandoffResult>("write_handoff", { root, dirRelPath });

/** Copy text to the OS clipboard. */
export const copyText = (text: string) => writeText(text);

export const readFile = (path: string) => invoke<string>("read_file", { path });

export const saveFile = (path: string, content: string) =>
  invoke<void>("save_file", { path, content });

/** Create a new markdown file in `dir`; returns its absolute path. */
export const createFile = (dir: string, name: string) =>
  invoke<string>("create_file", { dir, name });

/** Create a default-named ("Untitled") note in `dir`; returns its absolute path. */
export const createUntitled = (dir: string) =>
  invoke<string>("create_untitled", { dir });

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
