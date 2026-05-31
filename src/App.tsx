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
import { GitPanel } from "./components/GitPanel";
import { Settings } from "./components/Settings";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Onboarding } from "./components/Onboarding";
import { QuickOpen, type Command } from "./components/QuickOpen";
import { GraphView } from "./components/GraphView";
import { SpecsPanel } from "./components/SpecsPanel";
import {
  ClipboardList,
  Download,
  FilePlus,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Maximize2,
  Network,
  PanelRight,
  Settings as SettingsIcon,
  Star,
  SunMoon,
  Terminal,
  Upload,
} from "lucide-react";
import {
  createFile,
  createFolder,
  createUntitled,
  defaultVault,
  deleteEntry,
  listEntries,
  moveEntry,
  createSpec,
  onWorkspaceChanged,
  openTerminal,
  pickFolder,
  readFile,
  renameEntry,
  saveFile,
  scanLinks,
  scanSpecs,
  setSpecStatus,
  watchFolder,
} from "./lib/workspace";
import { buildGraph, type GraphEdge, type GraphNode } from "./lib/graph";
import { todayISO } from "./lib/specs";
import { toggleTask } from "./lib/tasks";
import {
  gitCommit,
  gitGetRemote,
  gitInit,
  gitIsRepo,
  gitLog,
  gitPull,
  gitPush,
  gitStage,
  gitStageAll,
  gitStatus,
  gitUnstage,
  gitUnstageAll,
  gitWorktree,
} from "./lib/git";
import { applyTemplate } from "./lib/templates";
import { normalizeTarget } from "./lib/wikilinks";
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  storeTheme,
  watchSystem,
  type Theme,
} from "./lib/theme";
import type { CommitInfo, FileEntry, GitFileStatus, GitStatus, Spec, SpecStatus } from "./types";

const PREVIEW_KEY = "branchnote.previewVisible";
/** How many commits to show in the Git panel's history list. */
const GIT_LOG_LIMIT = 50;
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

/** Drop a trailing markdown extension. */
function stripMd(name: string): string {
  return name.replace(/\.(md|markdown)$/i, "");
}

/** The note title = its first line with the leading `#`s stripped, or "". */
function titleFromDoc(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  return first.replace(/^#+\s*/, "").trim();
}

/** Replace just the first line of `content` with `# title`, keeping the rest. */
function setDocTitle(content: string, title: string): string {
  const nl = content.indexOf("\n");
  return `# ${title}${nl === -1 ? "" : content.slice(nl)}`;
}

/** Turn a title into a safe file name (no path separators / illegal chars). */
function sanitizeFileName(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\.+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
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
  /** Path of a just-created note whose editor should focus (cursor at end). */
  const [focusEditorFor, setFocusEditorFor] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FileEntry | null>(null);
  /** Ctrl/Cmd+P file palette. */
  const [quickOpen, setQuickOpen] = useState(false);
  /** Focus mode hides the sidebar + preview, centring the editor (Ctrl+Shift+F). */
  const [focusMode, setFocusMode] = useState(false);
  /** Graph view occupies the main area when open. */
  const [graphOpen, setGraphOpen] = useState(false);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  /** Specs are a left-panel view (SDD: specs are the primary navigation unit). */
  const [specsData, setSpecsData] = useState<Spec[]>([]);
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

  // Git (read path). `gitRepo === null` means detection hasn't run yet.
  const [gitRepo, setGitRepo] = useState<boolean | null>(null);
  const [gitStatusState, setGitStatusState] = useState<GitStatus | null>(null);
  const [gitStaged, setGitStaged] = useState<GitFileStatus[]>([]);
  const [gitUnstaged, setGitUnstaged] = useState<GitFileStatus[]>([]);
  const [gitLogState, setGitLogState] = useState<CommitInfo[]>([]);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  /** Advisory git message needing user action (e.g. a diverged pull). */
  const [gitWarn, setGitWarn] = useState<string | null>(null);
  const [gitNotice, setGitNotice] = useState<string | null>(null);
  /** Which sync action is in flight (for per-button progress labels). */
  const [gitBusy, setGitBusy] = useState<"push" | "pull" | null>(null);
  const [gitHasRemote, setGitHasRemote] = useState(false);

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
  // User templates: immediate `.md` children of a `templates/` folder.
  const templateFiles = useMemo(
    () =>
      files
        .filter(
          (f) =>
            !f.isDir &&
            f.relPath.startsWith("templates/") &&
            !f.relPath.slice("templates/".length).includes("/"),
        )
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    [files],
  );
  // Note basenames for `[[wikilink]]` autocomplete + existence styling.
  const wikiNames = useMemo(
    () => files.filter((f) => !f.isDir).map((f) => stripMd(f.name)),
    [files],
  );
  const wikiTargets = useMemo(
    () => new Set(wikiNames.map(normalizeTarget)),
    [wikiNames],
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

  /** Re-read git repo state (detect → status / changes / log) for the vault. */
  const refreshGit = useCallback(async () => {
    const v = live.current.vaultPath;
    if (!v) return;
    setGitLoading(true);
    try {
      const repo = await gitIsRepo(v);
      setGitRepo(repo);
      if (repo) {
        const [st, wt, lg, remote] = await Promise.all([
          gitStatus(v),
          gitWorktree(v),
          gitLog(v, GIT_LOG_LIMIT),
          gitGetRemote(v),
        ]);
        setGitStatusState(st);
        setGitStaged(wt.staged);
        setGitUnstaged(wt.unstaged);
        setGitLogState(lg);
        setGitHasRemote(remote != null && remote.trim() !== "");
      } else {
        setGitStatusState(null);
        setGitStaged([]);
        setGitUnstaged([]);
        setGitLogState([]);
        setGitHasRemote(false);
      }
      setGitError(null);
    } catch (e) {
      setGitError(formatErr(e));
    } finally {
      setGitLoading(false);
    }
  }, []);

  /** Initialise a repo in the current vault, then load its state. */
  async function onGitInit() {
    const v = vaultPath;
    if (!v) return;
    try {
      await gitInit(v);
    } catch (e) {
      setGitError(formatErr(e));
      return;
    }
    await refreshGit();
  }

  /** Run a git mutation against the current vault, surface errors, then refresh.
   *  Returns whether it succeeded (so the commit box knows when to clear). */
  const runGit = useCallback(
    async (fn: (vault: string) => Promise<void>): Promise<boolean> => {
      const v = live.current.vaultPath;
      if (!v) return false;
      setGitNotice(null);
      setGitWarn(null);
      try {
        await fn(v);
      } catch (e) {
        setGitError(formatErr(e));
        return false;
      }
      await refreshGit();
      return true;
    },
    [refreshGit],
  );

  /** Push the current branch, with a success notice. */
  async function onGitPush() {
    setGitBusy("push");
    try {
      if (await runGit((v) => gitPush(v))) setGitNotice("Pushed to origin");
    } finally {
      setGitBusy(null);
    }
  }

  /** Pull (fetch + fast-forward), surfacing the outcome. */
  async function onGitPull() {
    const v = live.current.vaultPath;
    if (!v) return;
    setGitError(null);
    setGitNotice(null);
    setGitWarn(null);
    setGitBusy("pull");
    let outcome: string;
    try {
      outcome = await gitPull(v);
    } catch (e) {
      setGitError(formatErr(e));
      return;
    } finally {
      setGitBusy(null);
    }
    await refreshGit();
    if (outcome === "up-to-date") {
      setGitNotice("Already up to date");
    } else if (outcome === "fast-forward") {
      setGitNotice("Fast-forwarded from origin");
    } else {
      setGitWarn(
        "Branch has diverged: you have local commits and origin has new ones. " +
          "Merge or rebase (e.g. `git pull --rebase` in a terminal), then push.",
      );
    }
  }

  // Load git state when the vault changes; clear it when there's no vault.
  useEffect(() => {
    setGitWarn(null);
    setGitNotice(null);
    if (!vaultPath) {
      setGitRepo(null);
      setGitStatusState(null);
      setGitStaged([]);
      setGitUnstaged([]);
      setGitLogState([]);
      return;
    }
    setGitRepo(null); // show the panel's loading state while detecting
    void refreshGit();
  }, [vaultPath, refreshGit]);

  // Build the wikilink graph when it's open (and refresh as files change).
  useEffect(() => {
    if (!graphOpen || !vaultPath) return;
    let cancelled = false;
    void scanLinks(vaultPath)
      .then((links) => {
        if (!cancelled) setGraphData(buildGraph(files, links));
      })
      .catch(() => {
        if (!cancelled) setGraphData({ nodes: [], edges: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [graphOpen, vaultPath, files]);

  // Project the specs/ folder when the Specs panel is shown (refresh as the disk
  // changes). The filesystem is the source of truth — this is a pure re-scan.
  useEffect(() => {
    if (sidebarView !== "specs" || !sidebarVisible || !vaultPath) return;
    let cancelled = false;
    void scanSpecs(vaultPath)
      .then((specs) => {
        if (!cancelled) setSpecsData(specs);
      })
      .catch(() => {
        if (!cancelled) setSpecsData([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sidebarView, sidebarVisible, vaultPath, files]);

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

  /** Rename a tab's file to match its first-line `#` title (quiet — collisions
   *  are ignored). The H1 is the source of truth for the file name. */
  const reconcileTitle = useCallback(
    async (tab: Tab) => {
      const v = live.current.vaultPath;
      if (!v || !tab.path) return;
      // Spec files (spec.md / plan.md / tasks.md under specs/) have structural
      // names — never auto-rename them from their H1.
      if (toRel(tab.path).startsWith("specs/")) return;
      const name = sanitizeFileName(titleFromDoc(tab.draft));
      if (!name || name === stripMd(basename(tab.path))) return;
      const oldPath = tab.path;
      let newPath: string;
      try {
        newPath = await renameEntry(oldPath, name);
      } catch {
        return; // collision / invalid — keep the current name silently
      }
      setFiles(await listEntries(v));
      const oldRel = toRel(oldPath);
      const newRel = toRel(newPath);
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
      setTabs((prev) =>
        prev.map((t) =>
          t.path && isUnder(t.path, oldPath)
            ? { ...t, path: swapPrefix(t.path, oldPath, newPath) }
            : t,
        ),
      );
    },
    [toRel],
  );

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
      if (cur) void flushTab(cur).then(() => reconcileTitle(cur));
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [active.id, active.draft, active.path, activeDirty, flushTab, reconcileTitle]);

  // Ctrl/Cmd+S flushes the active tab immediately.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const { tabs: ts, activeId: aid } = live.current;
        const cur = ts.find((t) => t.id === aid) ?? ts[0];
        if (cur)
          void run(async () => {
            await flushTab(cur);
            await reconcileTitle(cur);
          });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Editor power-ups: Ctrl/Cmd+P opens the quick-open palette; Ctrl+Shift+F
  // toggles focus mode. (Ctrl+F is the editor's own find panel.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuickOpen((v) => !v);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFocusMode((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Suppress the WebView's native context menu everywhere; our own menus (e.g.
  // the Sidebar's) are React state-driven and unaffected.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  function updateActiveDraft(value: string) {
    patchTab(active.id, { draft: value });
  }

  /** Toggle the index-th task checkbox in the active note (clicked in preview).
   *  Edits the draft; the autosave effect persists it and spec progress refreshes. */
  function onToggleTask(index: number) {
    const next = toggleTask(active.draft, index);
    if (next !== active.draft) patchTab(active.id, { draft: next });
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
      // Specs-first: if this vault already has specs, land on the Specs panel.
      setGraphOpen(false);
      if (list.some((f) => f.isDir && f.relPath === "specs")) {
        setSidebarView("specs");
        setSidebarVisible(true);
      }
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

  /** Open the OS terminal in `dir` (default: the vault root) so an external AI
   *  agent can run there. */
  async function onOpenTerminal(dir?: string) {
    const target = dir ?? vaultPath;
    if (!target) return;
    try {
      await openTerminal(target);
    } catch (e) {
      setError(formatErr(e));
    }
  }

  /** Create a new spec folder from a title, refresh the list, and open its
   *  `spec.md` in the editor. */
  async function onCreateSpec(title: string) {
    if (!vaultPath) return;
    await run(async () => {
      await flushTab(active);
      const spec = await createSpec(vaultPath, title, todayISO());
      setFiles(await listEntries(vaultPath));
      setSpecsData(await scanSpecs(vaultPath));
      const content = await readFile(spec.specPath);
      patchTab(active.id, { path: spec.specPath, draft: content, saved: content });
    });
  }

  /** Set a spec's status (a human declaration), then re-project the list. */
  async function onSetSpecStatus(spec: Spec, status: SpecStatus) {
    if (!vaultPath) return;
    try {
      await setSpecStatus(spec.specPath, status, todayISO());
      setSpecsData(await scanSpecs(vaultPath));
    } catch (e) {
      setError(formatErr(e));
    }
  }

  /** Open a file in the active tab (replacing its content). */
  async function selectFile(path: string) {
    setGraphOpen(false);
    if (active.path === path) return;
    await run(async () => {
      await flushTab(active);
      const content = await readFile(path);
      patchTab(active.id, { path, draft: content, saved: content });
    });
  }

  /** Open a file in a brand-new tab. */
  async function openInNewTab(path: string) {
    setGraphOpen(false);
    await run(async () => {
      const content = await readFile(path);
      const tab: Tab = { id: newId(), path, draft: content, saved: content };
      setTabs((prev) => [...prev, tab]);
      setActiveId(tab.id);
    });
  }

  /** Open the note a `[[wikilink]]` targets, creating it (seeded with the title)
   *  if no note with that name exists yet. */
  async function onOpenWikilink(target: string) {
    if (!vaultPath) return;
    const want = normalizeTarget(target);
    const match = files.find((f) => !f.isDir && normalizeTarget(f.name) === want);
    if (match) {
      void selectFile(match.path);
      return;
    }
    await run(async () => {
      await flushTab(active);
      const newPath = await createFile(vaultPath, sanitizeFileName(target) || "Untitled");
      const body = `# ${target}\n`;
      await saveFile(newPath, body);
      setFiles(await listEntries(vaultPath));
      patchTab(active.id, { path: newPath, draft: body, saved: body });
      setFocusEditorFor(newPath);
    });
  }

  /** Create a note in `dir` seeded with an empty `# ` heading, open it, focus it. */
  async function handleCreateUntitled(dir: string) {
    if (!vaultPath) return;
    await run(async () => {
      await flushTab(active);
      const newPath = await createUntitled(dir);
      await saveFile(newPath, "# ");
      setFiles(await listEntries(vaultPath));
      patchTab(active.id, { path: newPath, draft: "# ", saved: "# " });
      setFocusEditorFor(newPath);
    });
  }

  /** Create a new note in `dir` from a template body, fill placeholders, open it. */
  async function handleNewFromTemplate(dir: string, rawBody: string) {
    if (!vaultPath) return;
    await run(async () => {
      await flushTab(active);
      const newPath = await createUntitled(dir);
      const body = applyTemplate(rawBody, { title: stripMd(basename(newPath)) });
      await saveFile(newPath, body);
      setFiles(await listEntries(vaultPath));
      patchTab(active.id, { path: newPath, draft: body, saved: body });
      setFocusEditorFor(newPath);
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
      const isFile = files.find((f) => f.path === path)?.isDir === false;
      const newPath = await renameEntry(path, newName);
      // Two-way sync: a file rename rewrites its first-line `#` title to match.
      let newContent: string | null = null;
      if (isFile) {
        const bare = stripMd(basename(newPath));
        const openTab = tabs.find((t) => t.path === path);
        const base = openTab ? openTab.draft : await readFile(newPath);
        const updated = setDocTitle(base, bare);
        if (updated !== base) {
          await saveFile(newPath, updated);
          newContent = updated;
        } else if (openTab) {
          newContent = updated; // unchanged, but keep the open tab in sync
        }
      }
      setFiles(await listEntries(vaultPath));
      swapFavorite(toRel(path), toRel(newPath));
      setTabs((prev) =>
        prev.map((t) => {
          if (!t.path || !isUnder(t.path, path)) return t;
          const np = swapPrefix(t.path, path, newPath);
          if (t.path === path && newContent !== null) {
            return { ...t, path: np, draft: newContent, saved: newContent };
          }
          return { ...t, path: np };
        }),
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
    void refreshGit(); // disk changed (incl. .git/) — re-read git state
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
  }, [refreshGit]);

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

  const ic = (node: React.ReactNode) => node;
  const nextTheme: Theme =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  // Quick actions shown above files in the command palette (Ctrl/Cmd+P).
  const commands: Command[] = vaultPath
    ? [
        { id: "new-file", label: "New file", keywords: "create note", icon: ic(<FilePlus size={14} />), run: () => void handleCreateUntitled(vaultPath) },
        { id: "new-folder", label: "New folder", keywords: "create directory", icon: ic(<FolderPlus size={14} />), run: () => void handleCreateFolder(vaultPath, "Untitled folder") },
        { id: "toggle-preview", label: previewVisible ? "Hide preview" : "Show preview", keywords: "markdown render", icon: ic(<PanelRight size={14} />), run: () => setPreviewVisible((v) => !v) },
        { id: "focus-mode", label: focusMode ? "Exit focus mode" : "Focus mode", hint: "Ctrl+Shift+F", keywords: "distraction free", icon: ic(<Maximize2 size={14} />), run: () => setFocusMode((v) => !v) },
        { id: "specs", label: "Open specs", keywords: "spec sdd requirements plan tasks", icon: ic(<ClipboardList size={14} />), run: () => onActivateView("specs") },
        { id: "graph", label: "Open graph view", keywords: "links network connections", icon: ic(<Network size={14} />), run: () => setGraphOpen(true) },
        { id: "theme", label: `Theme: switch to ${nextTheme}`, keywords: "dark light system appearance", icon: ic(<SunMoon size={14} />), run: () => changeTheme(nextTheme) },
        { id: "git", label: "Open Source control", keywords: "git version", icon: ic(<GitBranch size={14} />), run: () => onActivateView("git") },
        { id: "git-pull", label: "Git: Pull", keywords: "fetch sync", icon: ic(<Download size={14} />), run: () => void onGitPull() },
        { id: "git-push", label: "Git: Push", keywords: "sync upload", icon: ic(<Upload size={14} />), run: () => void onGitPush() },
        { id: "favorites", label: "Show favorites", keywords: "starred", icon: ic(<Star size={14} />), run: () => onActivateView("favorites") },
        { id: "settings", label: "Open Settings", keywords: "preferences config", icon: ic(<SettingsIcon size={14} />), run: () => setSettingsOpen(true) },
        { id: "change-vault", label: "Change vault…", keywords: "open folder workspace", icon: ic(<FolderOpen size={14} />), run: () => void changeVault() },
        { id: "terminal", label: "Open terminal in vault", keywords: "shell console ai agent claude aider", icon: ic(<Terminal size={14} />), run: () => void onOpenTerminal() },
      ]
    : [];

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
              onQuickOpen={() => setQuickOpen(true)}
              graphActive={graphOpen}
              onToggleGraph={() => setGraphOpen((v) => !v)}
            />

            {sidebarVisible &&
              !focusMode &&
              (sidebarView === "specs" ? (
                <SpecsPanel
                  specs={specsData}
                  files={files}
                  selectedPath={active.path}
                  onOpenFile={selectFile}
                  onCreateSpec={(title) => void onCreateSpec(title)}
                  onSetStatus={(spec, status) => void onSetSpecStatus(spec, status)}
                />
              ) : sidebarView === "git" ? (
                <GitPanel
                  isRepo={gitRepo}
                  status={gitStatusState}
                  staged={gitStaged}
                  unstaged={gitUnstaged}
                  log={gitLogState}
                  loading={gitLoading}
                  busy={gitBusy}
                  hasRemote={gitHasRemote}
                  error={gitError}
                  warn={gitWarn}
                  notice={gitNotice}
                  onInit={onGitInit}
                  onRefresh={() => void refreshGit()}
                  onPull={() => void onGitPull()}
                  onPush={() => void onGitPush()}
                  onOpenFile={(rel) => {
                    const f = files.find((x) => x.relPath === rel && !x.isDir);
                    if (f) void selectFile(f.path);
                  }}
                  onStage={(rel) => void runGit((v) => gitStage(v, rel))}
                  onUnstage={(rel) => void runGit((v) => gitUnstage(v, rel))}
                  onStageAll={() => void runGit((v) => gitStageAll(v))}
                  onUnstageAll={() => void runGit((v) => gitUnstageAll(v))}
                  onCommit={(msg) => runGit((v) => gitCommit(v, msg))}
                />
              ) : (
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
                  onCreateUntitled={handleCreateUntitled}
                  onNewFromTemplate={handleNewFromTemplate}
                  templateFiles={templateFiles}
                  onCreateFolder={handleCreateFolder}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onMove={handleMove}
                  onOpenTerminal={onOpenTerminal}
                />
              ))}

            <div className="flex min-w-0 flex-1 flex-col">
              <TabBar
                tabs={tabViews}
                onSelect={setActiveTab}
                onClose={closeTab}
                onNewTab={newTab}
                previewVisible={previewVisible}
                onTogglePreview={() => setPreviewVisible((v) => !v)}
                focusMode={focusMode}
                onToggleFocusMode={() => setFocusMode((v) => !v)}
              />

              {graphOpen ? (
                <GraphView
                  nodes={graphData.nodes}
                  edges={graphData.edges}
                  onOpenFile={(rel) => {
                    const f = files.find((x) => x.relPath === rel && !x.isDir);
                    if (f) void selectFile(f.path);
                  }}
                  onClose={() => setGraphOpen(false)}
                />
              ) : active.path ? (
                <main className="flex min-h-0 flex-1">
                  <EditorPane
                    key={active.id}
                    value={active.draft}
                    onChange={updateActiveDraft}
                    effectiveTheme={effectiveTheme}
                    autoFocusEnd={focusEditorFor === active.path}
                    onAutoFocused={() => setFocusEditorFor(null)}
                    wikiNames={wikiNames}
                  />
                  {previewVisible && !focusMode && (
                    <PreviewPane
                      content={active.draft}
                      wikiTargets={wikiTargets}
                      onOpenWikilink={onOpenWikilink}
                      onToggleTask={onToggleTask}
                    />
                  )}
                </main>
              ) : (
                <StartView
                  favoriteFiles={favoriteFiles}
                  templateFiles={templateFiles}
                  onCreateUntitled={() => handleCreateUntitled(vaultPath)}
                  onNewFromTemplate={(body) => handleNewFromTemplate(vaultPath, body)}
                  onCreateFolder={(name) => handleCreateFolder(vaultPath, name)}
                  onOpenFile={selectFile}
                  onChangeVault={changeVault}
                />
              )}
            </div>
          </div>

          <StatusBar
            git={
              gitStatusState ?? {
                branch: gitRepo === false ? "no repo" : "—",
                changedFiles: 0,
                clean: true,
                ahead: null,
                behind: null,
              }
            }
            dirty={activeDirty}
          />
        </>
      )}

      {settingsOpen && (
        <Settings
          theme={theme}
          onThemeChange={changeTheme}
          vaultPath={vaultPath}
          onChangeVault={changeVault}
          onOpenTerminal={onOpenTerminal}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {quickOpen && vaultPath && (
        <QuickOpen
          files={files}
          commands={commands}
          onOpen={selectFile}
          onOpenInNewTab={openInNewTab}
          onClose={() => setQuickOpen(false)}
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
