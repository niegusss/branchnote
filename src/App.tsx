import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { Rail, type SidebarView } from "./components/Rail";
import { TabBar, type TabView } from "./components/TabBar";
import { EditorPane } from "./components/EditorPane";
import { PreviewPane } from "./components/PreviewPane";
import { StartView } from "./components/StartView";
import { StatusBar } from "./components/StatusBar";
import { Settings } from "./components/Settings";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Onboarding } from "./components/Onboarding";
import {
  createFile,
  createFolder,
  defaultVault,
  deleteEntry,
  listEntries,
  moveEntry,
  onWorkspaceChanged,
  pickFolder,
  placeholderGitStatus,
  readFile,
  renameEntry,
  saveFile,
  watchFolder,
} from "./lib/workspace";
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  storeTheme,
  watchSystem,
  type Theme,
} from "./lib/theme";
import type { FileEntry } from "./types";

const PREVIEW_KEY = "branchnote.previewVisible";
const SIDEBAR_KEY = "branchnote.sidebarVisible";
const VAULT_KEY = "branchnote.vaultPath";
const FAVORITES_KEY = "branchnote.favorites";
/** How long after the last keystroke to auto-save the active tab. */
const AUTOSAVE_MS = 600;

/** One open editor tab. `path: null` is an empty tab showing the start view. */
interface Tab {
  id: string;
  path: string | null;
  draft: string;
  saved: string;
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `t${Date.now()}${Math.random().toString(16).slice(2)}`;

const emptyTab = (): Tab => ({ id: newId(), path: null, draft: "", saved: "" });
const isDirty = (t: Tab): boolean => t.path !== null && t.draft !== t.saved;

/** Favorites are stored per-vault as relPaths under a single localStorage map. */
function loadFavorites(vault: string): Set<string> {
  try {
    const all = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "{}");
    const arr = all?.[vault];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveFavorites(vault: string, favs: Set<string>): void {
  let all: Record<string, string[]> = {};
  try {
    all = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "{}");
  } catch {
    all = {};
  }
  all[vault] = [...favs];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(all));
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || p;
}

function formatErr(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Is `child` the same as, or nested under, `parent` (path-wise)? */
function isUnder(child: string, parent: string): boolean {
  return (
    child === parent ||
    child.startsWith(parent + "/") ||
    child.startsWith(parent + "\\")
  );
}

/** Replace an `oldParent` path prefix on `child` with `newParent`. */
function swapPrefix(child: string, oldParent: string, newParent: string): string {
  return child === oldParent ? newParent : newParent + child.slice(oldParent.length);
}

/** Workspace shell wired to the Tauri Rust core. */
function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(
    () => localStorage.getItem(VAULT_KEY),
  );
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [tabs, setTabs] = useState<Tab[]>(() => [emptyTab()]);
  const [activeId, setActiveId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FileEntry | null>(null);
  const [previewVisible, setPreviewVisible] = useState<boolean>(() => {
    const v = localStorage.getItem(PREVIEW_KEY);
    return v === null ? true : v === "true";
  });
  const [sidebarView, setSidebarView] = useState<SidebarView>("files");
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(() => {
    const v = localStorage.getItem(SIDEBAR_KEY);
    return v === null ? true : v === "true";
  });
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() =>
    resolveTheme(getStoredTheme()),
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const activeDirty = isDirty(active);
  const activeFile = useMemo(
    () => files.find((f) => f.path === active.path) ?? null,
    [files, active.path],
  );
  const dirtyPaths = useMemo(() => {
    const s = new Set<string>();
    for (const t of tabs) if (isDirty(t) && t.path) s.add(t.path);
    return s;
  }, [tabs]);
  const favoriteFiles = useMemo(
    () =>
      files
        .filter((f) => !f.isDir && favorites.has(f.relPath))
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    [files, favorites],
  );

  /** Convert an absolute path to a vault-relative, forward-slashed path. */
  const toRel = useCallback(
    (abs: string): string => {
      if (!vaultPath) return abs;
      const r = abs.startsWith(vaultPath) ? abs.slice(vaultPath.length) : abs;
      return r.replace(/^[\\/]+/, "").replace(/\\/g, "/");
    },
    [vaultPath],
  );

  function toggleFavorite(relPath: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(relPath)) next.delete(relPath);
      else next.add(relPath);
      return next;
    });
  }

  /** Keep favorites pointing at the right path after a rename/move. */
  function swapFavorite(oldRel: string, newRel: string) {
    setFavorites((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const r of prev) {
        if (r === oldRel) {
          next.add(newRel);
          changed = true;
        } else if (r.startsWith(oldRel + "/")) {
          next.add(newRel + r.slice(oldRel.length));
          changed = true;
        } else {
          next.add(r);
        }
      }
      return changed ? next : prev;
    });
  }

  // Persist favorites for the current vault whenever they change.
  useEffect(() => {
    if (vaultPath) saveFavorites(vaultPath, favorites);
  }, [favorites, vaultPath]);

  // Prune favorites whose entry no longer exists (external deletes/moves).
  useEffect(() => {
    if (!vaultPath) return;
    setFavorites((prev) => {
      const valid = new Set(files.map((f) => f.relPath));
      let changed = false;
      const next = new Set<string>();
      for (const r of prev) {
        if (valid.has(r)) next.add(r);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [files, vaultPath]);

  useEffect(() => {
    localStorage.setItem(PREVIEW_KEY, String(previewVisible));
  }, [previewVisible]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarVisible));
  }, [sidebarVisible]);

  /** Rail view click: toggle the panel if re-activating the current view. */
  function onActivateView(view: SidebarView) {
    if (view === sidebarView && sidebarVisible) {
      setSidebarVisible(false);
    } else {
      setSidebarView(view);
      setSidebarVisible(true);
    }
  }

  // Re-resolve the theme live while following the OS.
  useEffect(() => {
    if (theme !== "system") return;
    return watchSystem(() => setEffectiveTheme(applyTheme("system")));
  }, [theme]);

  function changeTheme(next: Theme) {
    setTheme(next);
    storeTheme(next);
    setEffectiveTheme(applyTheme(next));
  }

  // Latest values for the watch / autosave / shortcut handlers to read freshly.
  const live = useRef({ vaultPath, tabs, activeId });
  useEffect(() => {
    live.current = { vaultPath, tabs, activeId };
  });

  function patchTab(id: string, patch: Partial<Tab>) {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  /** Write a tab's edits to disk if dirty, then mark it saved. */
  const flushTab = useCallback(async (tab: Tab) => {
    if (tab.path === null || tab.draft === tab.saved) return;
    const { id, path, draft } = tab;
    await saveFile(path, draft);
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, saved: draft } : t)));
  }, []);

  /** Run an async action with busy/error bookkeeping. */
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(formatErr(e));
    } finally {
      setBusy(false);
    }
  }

  // Auto-save the active tab a short while after typing stops.
  useEffect(() => {
    if (!activeDirty) return;
    const id = active.id;
    const timer = setTimeout(() => {
      const cur = live.current.tabs.find((t) => t.id === id);
      if (cur) void flushTab(cur);
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [active.id, active.draft, active.path, activeDirty, flushTab]);

  // Ctrl/Cmd+S flushes the active tab immediately.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const { tabs: ts, activeId: aid } = live.current;
        const cur = ts.find((t) => t.id === aid) ?? ts[0];
        if (cur) void run(() => flushTab(cur));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateActiveDraft(value: string) {
    patchTab(active.id, { draft: value });
  }

  function newTab() {
    const tab = emptyTab();
    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }

  async function setActiveTab(id: string) {
    if (id === active.id) return;
    await flushTab(active);
    setActiveId(id);
  }

  async function closeTab(id: string) {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    await flushTab(tab);
    const idx = tabs.findIndex((t) => t.id === id);
    const remaining = tabs.filter((t) => t.id !== id);
    if (remaining.length === 0) {
      const fresh = emptyTab();
      setTabs([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setTabs(remaining);
    if (id === active.id) {
      const neighbor = remaining[Math.min(idx, remaining.length - 1)];
      setActiveId(neighbor.id);
    }
  }

  /** Open a vault (used on launch, onboarding, and change-vault). */
  const openVault = useCallback(async (path: string) => {
    setBusy(true);
    setError(null);
    try {
      const list = await listEntries(path);
      await watchFolder(path);
      setVaultPath(path);
      localStorage.setItem(VAULT_KEY, path);
      setFiles(list);
      setFavorites(loadFavorites(path));
      const fresh = emptyTab();
      setTabs([fresh]);
      setActiveId(fresh.id);
    } catch (e) {
      setError(formatErr(e));
      setVaultPath(null);
      localStorage.removeItem(VAULT_KEY);
    } finally {
      setBusy(false);
    }
  }, []);

  // On first mount, reopen the stored vault (if any).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const stored = localStorage.getItem(VAULT_KEY);
    if (stored) void openVault(stored);
  }, [openVault]);

  async function onChooseFolder() {
    setError(null);
    let picked: string | null = null;
    try {
      picked = await pickFolder();
    } catch (e) {
      setError(formatErr(e));
      return;
    }
    if (picked) await openVault(picked);
  }

  async function onUseDefault() {
    setError(null);
    try {
      const path = await defaultVault();
      await openVault(path);
    } catch (e) {
      setError(formatErr(e));
    }
  }

  async function changeVault() {
    let picked: string | null = null;
    try {
      picked = await pickFolder();
    } catch (e) {
      setError(formatErr(e));
      return;
    }
    if (picked) {
      setSettingsOpen(false);
      await openVault(picked);
    }
  }

  /** Open a file in the active tab (replacing its content). */
  async function selectFile(path: string) {
    if (active.path === path) return;
    await run(async () => {
      await flushTab(active);
      const content = await readFile(path);
      patchTab(active.id, { path, draft: content, saved: content });
    });
  }

  /** Open a file in a brand-new tab. */
  async function openInNewTab(path: string) {
    await run(async () => {
      const content = await readFile(path);
      const tab: Tab = { id: newId(), path, draft: content, saved: content };
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
    });
  }

  async function handleCreateFile(dir: string, name: string) {
    if (!vaultPath) return;
    await run(async () => {
      await flushTab(active);
      const newPath = await createFile(dir, name);
      setFiles(await listEntries(vaultPath));
      const content = await readFile(newPath);
      patchTab(active.id, { path: newPath, draft: content, saved: content });
    });
  }

  async function handleCreateFolder(dir: string, name: string) {
    if (!vaultPath) return;
    await run(async () => {
      await createFolder(dir, name);
      setFiles(await listEntries(vaultPath));
    });
  }

  async function handleRename(path: string, newName: string) {
    if (!vaultPath) return;
    await run(async () => {
      const newPath = await renameEntry(path, newName);
      setFiles(await listEntries(vaultPath));
      swapFavorite(toRel(path), toRel(newPath));
      setTabs((prev) =>
        prev.map((t) =>
          t.path && isUnder(t.path, path)
            ? { ...t, path: swapPrefix(t.path, path, newPath) }
            : t,
        ),
      );
    });
  }

  /** Request deletion: open the confirm modal for the targeted entry. */
  function handleDelete(path: string) {
    const entry = files.find((f) => f.path === path);
    if (entry) setPendingDelete(entry);
  }

  /** Carry out the deletion confirmed in the modal. */
  async function confirmDeleteEntry() {
    const entry = pendingDelete;
    setPendingDelete(null);
    if (!vaultPath || !entry) return;
    const path = entry.path;
    await run(async () => {
      await deleteEntry(path);
      setFiles(await listEntries(vaultPath));
      setTabs((prev) =>
        prev.map((t) =>
          t.path && isUnder(t.path, path)
            ? { ...t, path: null, draft: "", saved: "" }
            : t,
        ),
      );
    });
  }

  async function handleMove(src: string, destDir: string) {
    if (!vaultPath) return;
    setBusy(true);
    try {
      const newPath = await moveEntry(src, destDir);
      setFiles(await listEntries(vaultPath));
      swapFavorite(toRel(src), toRel(newPath));
      setTabs((prev) =>
        prev.map((t) =>
          t.path && isUnder(t.path, src)
            ? { ...t, path: swapPrefix(t.path, src, newPath) }
            : t,
        ),
      );
    } catch {
      // A failed drag (name collision, dropping into the same/own folder, or
      // a folder onto its descendant) is treated as a silent no-op — no banner.
    } finally {
      setBusy(false);
    }
  }

  // React to external (watched) changes: re-list, then for each tab drop a
  // vanished file or reload its content (skipping the active tab if it has
  // unsaved edits, so in-flight keystrokes are never clobbered).
  const handleExternalChange = useCallback(async () => {
    const { vaultPath: v, tabs: ts, activeId: aid } = live.current;
    if (!v) return;
    try {
      const list = await listEntries(v);
      setFiles(list);
      const exists = new Set(list.map((f) => f.path));
      const updates = new Map<string, string | null>();
      for (const t of ts) {
        if (!t.path) continue;
        if (!exists.has(t.path)) {
          updates.set(t.id, null);
          continue;
        }
        if (t.id === aid && t.draft !== t.saved) continue; // being edited
        updates.set(t.id, await readFile(t.path));
      }
      if (updates.size === 0) return;
      setTabs((prev) =>
        prev.map((t) => {
          const c = updates.get(t.id);
          if (c === undefined) return t;
          return c === null
            ? { ...t, path: null, draft: "", saved: "" }
            : { ...t, draft: c, saved: c };
        }),
      );
    } catch {
      // Transient races during rapid edits; the next event will resync.
    }
  }, []);

  useEffect(() => {
    if (!vaultPath) return;
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;
    onWorkspaceChanged(() => void handleExternalChange()).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [vaultPath, handleExternalChange]);

  const tabViews: TabView[] = tabs.map((t) => ({
    id: t.id,
    name: t.path ? (files.find((f) => f.path === t.path)?.name ?? basename(t.path)) : null,
    dirty: isDirty(t),
    active: t.id === active.id,
  }));

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <TitleBar
        vaultName={vaultPath ? basename(vaultPath) : null}
        fileName={activeFile?.name ?? null}
        dirty={activeDirty}
      />

      {vaultPath === null ? (
        <Onboarding
          onChooseFolder={onChooseFolder}
          onUseDefault={onUseDefault}
          busy={busy}
          error={error}
        />
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 border-b border-danger/30 bg-danger/10 px-3 py-1.5 text-sm text-danger"
            >
              <span className="truncate">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 rounded px-1.5 text-danger transition-colors hover:bg-danger/15"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            <Rail
              view={sidebarView}
              sidebarVisible={sidebarVisible}
              onActivateView={onActivateView}
              onOpenSettings={() => setSettingsOpen(true)}
            />

            {sidebarVisible && (
              <Sidebar
                files={files}
                root={vaultPath}
                selectedPath={active.path}
                dirtyPaths={dirtyPaths}
                favorites={favorites}
                view={sidebarView}
                onViewChange={setSidebarView}
                onToggleFavorite={toggleFavorite}
                onSelect={selectFile}
                onOpenInNewTab={openInNewTab}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRename={handleRename}
                onDelete={handleDelete}
                onMove={handleMove}
              />
            )}

            <div className="flex min-w-0 flex-1 flex-col">
              <TabBar
                tabs={tabViews}
                onSelect={setActiveTab}
                onClose={closeTab}
                onNewTab={newTab}
                previewVisible={previewVisible}
                onTogglePreview={() => setPreviewVisible((v) => !v)}
              />

              {active.path ? (
                <main className="flex min-h-0 flex-1">
                  <EditorPane
                    key={active.id}
                    value={active.draft}
                    onChange={updateActiveDraft}
                    effectiveTheme={effectiveTheme}
                  />
                  {previewVisible && <PreviewPane content={active.draft} />}
                </main>
              ) : (
                <StartView
                  favoriteFiles={favoriteFiles}
                  onCreateFile={(name) => handleCreateFile(vaultPath, name)}
                  onCreateFolder={(name) => handleCreateFolder(vaultPath, name)}
                  onOpenFile={selectFile}
                  onChangeVault={changeVault}
                />
              )}
            </div>
          </div>

          <StatusBar git={placeholderGitStatus} dirty={activeDirty} />
        </>
      )}

      {settingsOpen && (
        <Settings
          theme={theme}
          onThemeChange={changeTheme}
          vaultPath={vaultPath}
          onChangeVault={changeVault}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.isDir ? "Delete folder" : "Delete file"}
          message={
            pendingDelete.isDir
              ? `Delete folder "${pendingDelete.name}" and everything inside it? This cannot be undone.`
              : `Delete "${pendingDelete.name}"? This cannot be undone.`
          }
          danger
          onConfirm={confirmDeleteEntry}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

export default App;
