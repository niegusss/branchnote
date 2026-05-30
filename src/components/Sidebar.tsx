import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  SquarePlus,
  Star,
  Trash2,
} from "lucide-react";
import type { FileEntry } from "../types";
import { buildTree, type TreeNode } from "../lib/tree";
import { textInput } from "../lib/ui";
import type { SidebarView } from "./Rail";

/** Active-row treatment: a soft accent tint (no left bar). */
const ROW_ACTIVE = "bg-accent/10 text-accent";

interface SidebarProps {
  files: FileEntry[];
  /** Absolute workspace root, or null when no folder is open. */
  root: string | null;
  selectedPath: string | null;
  /** Paths with unsaved edits (renders a dot). */
  dirtyPaths: Set<string>;
  /** Favorited entries, as vault-relative paths. */
  favorites: Set<string>;
  /** Which view the panel shows (controlled by the rail). */
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  onToggleFavorite: (relPath: string) => void;
  onSelect: (path: string) => void;
  onOpenInNewTab: (path: string) => void;
  onCreateFile: (dir: string, name: string) => void;
  onCreateFolder: (dir: string, name: string) => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string) => void;
  onMove: (src: string, destDir: string) => void;
}

/** Constant left padding inside every row; nesting depth comes from <ul> margins. */
const ROW_PAD = 6;
/** Assumed menu width (px) for viewport clamping. */
const MENU_W = 188;

type ContextMenu = { x: number; y: number; entry: FileEntry; inTree: boolean };

export function Sidebar({
  files,
  root,
  selectedPath,
  dirtyPaths,
  favorites,
  view,
  onViewChange,
  onToggleFavorite,
  onSelect,
  onOpenInNewTab,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
}: SidebarProps) {
  const showFavorites = view === "favorites";
  const tree = useMemo(() => buildTree(files), [files]);
  const favoriteEntries = useMemo(
    () =>
      files
        .filter((f) => favorites.has(f.relPath))
        .sort((a, b) =>
          a.isDir !== b.isDir
            ? a.isDir
              ? -1
              : 1
            : a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
        ),
    [files, favorites],
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<{
    dir: string;
    kind: "file" | "folder";
  } | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenu | null>(null);

  // Dismiss the context menu on any click, Escape, scroll, or resize.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function toggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function startCreate(dir: string, kind: "file" | "folder") {
    // Make sure the target folder is expanded so the input is visible.
    if (dir !== root) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(dir);
        return next;
      });
    }
    setCreating({ dir, kind });
    setDraftName("");
  }

  function commitCreate() {
    if (!creating) return;
    const name = draftName.trim();
    if (name) {
      if (creating.kind === "file") onCreateFile(creating.dir, name);
      else onCreateFolder(creating.dir, name);
    }
    setCreating(null);
    setDraftName("");
  }

  function cancelCreate() {
    setCreating(null);
    setDraftName("");
  }

  function startRename(path: string, name: string) {
    setRenamingPath(path);
    setRenameName(name);
  }

  function commitRename(path: string, original: string) {
    const name = renameName.trim();
    if (name && name !== original) onRename(path, name);
    setRenamingPath(null);
    setRenameName("");
  }

  function handleDrop(e: React.DragEvent, destDir: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const src = e.dataTransfer.getData("text/plain");
    if (!src || src === destDir) return;
    // Skip no-op drops: item already lives directly in the target folder.
    const i = Math.max(src.lastIndexOf("/"), src.lastIndexOf("\\"));
    const srcParent = i > 0 ? src.slice(0, i) : src;
    if (srcParent === destDir) return;
    onMove(src, destDir);
  }

  function openMenu(e: React.MouseEvent, entry: FileEntry, inTree: boolean) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, entry, inTree });
  }

  function nameInput(
    value: string,
    setValue: (v: string) => void,
    commit: () => void,
    cancel: () => void,
    placeholder?: string,
  ) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        placeholder={placeholder}
        className={textInput}
      />
    );
  }

  /** Leave the favorites view and reveal a folder in the tree. */
  function revealFolder(path: string) {
    onViewChange("files");
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }

  function renderFavoriteRow(entry: FileEntry) {
    const active = entry.path === selectedPath;
    const renaming = renamingPath === entry.path;
    const parentRel = entry.relPath.includes("/")
      ? entry.relPath.slice(0, entry.relPath.lastIndexOf("/"))
      : "";
    return (
      <li key={entry.path}>
        <div
          onContextMenu={(e) => openMenu(e, entry, false)}
          className={`group flex items-center rounded-md text-sm transition-colors ${
            active ? ROW_ACTIVE : "text-muted hover:bg-hover hover:text-ink"
          }`}
          style={{ paddingLeft: 8 }}
        >
          {renaming ? (
            <div className="flex-1 py-0.5 pr-1">
              {nameInput(
                renameName,
                setRenameName,
                () => commitRename(entry.path, entry.name),
                () => setRenamingPath(null),
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => (entry.isDir ? revealFolder(entry.path) : onSelect(entry.path))}
              title={entry.relPath}
              className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left active:scale-[0.99]"
            >
              {entry.isDir ? (
                <Folder size={14} className="shrink-0 text-faint" aria-hidden />
              ) : (
                <FileText size={14} className="shrink-0 text-faint" aria-hidden />
              )}
              <span className="truncate">{entry.name}</span>
              {parentRel && (
                <span className="truncate text-xs text-faint">{parentRel}</span>
              )}
            </button>
          )}
        </div>
      </li>
    );
  }

  function renderNode(node: TreeNode): React.ReactNode {
    const { entry } = node;
    const { path, name, isDir } = entry;
    const renaming = renamingPath === path;

    if (isDir) {
      const isCollapsed = collapsed.has(path);
      const dropping = dragOver === path;
      return (
        <li key={path}>
          <div
            draggable={!renaming}
            onContextMenu={(e) => openMenu(e, entry, true)}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", path);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
              if (dragOver !== path) setDragOver(path);
            }}
            onDrop={(e) => handleDrop(e, path)}
            onDragEnd={() => setDragOver(null)}
            className={`group flex items-center rounded-md text-sm transition-colors ${
              dropping
                ? "bg-accent/10 ring-1 ring-accent/40"
                : "text-ink hover:bg-hover"
            }`}
            style={{ paddingLeft: ROW_PAD }}
          >
            {renaming ? (
              <div className="flex-1 py-0.5 pr-1">
                {nameInput(
                  renameName,
                  setRenameName,
                  () => commitRename(path, name),
                  () => setRenamingPath(null),
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => toggle(path)}
                className="flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-2 text-left active:scale-[0.99]"
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
                <span className="truncate">{name}</span>
              </button>
            )}
          </div>

          {!isCollapsed && (
            <ul className="ml-3 border-l border-line pl-2">
              {creating?.dir === path && (
                <li style={{ paddingLeft: ROW_PAD }} className="py-0.5 pr-1">
                  {nameInput(
                    draftName,
                    setDraftName,
                    commitCreate,
                    cancelCreate,
                    creating.kind === "file" ? "name.md" : "folder name",
                  )}
                </li>
              )}
              {node.children.map((child) => renderNode(child))}
            </ul>
          )}
        </li>
      );
    }

    // File row. Dropping on a file targets its containing folder, so an
    // expanded folder's files are valid drop zones too.
    const active = path === selectedPath;
    const dirty = dirtyPaths.has(path);
    const sepIdx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const parentDir = sepIdx > 0 ? path.slice(0, sepIdx) : path;
    return (
      <li key={path}>
        <div
          draggable={!renaming}
          onContextMenu={(e) => openMenu(e, entry, true)}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", path);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            if (dragOver !== parentDir) setDragOver(parentDir);
          }}
          onDrop={(e) => handleDrop(e, parentDir)}
          onDragEnd={() => setDragOver(null)}
          className={`group flex items-center rounded-md text-sm transition-colors ${
            active ? ROW_ACTIVE : "text-muted hover:bg-hover hover:text-ink"
          }`}
          style={{ paddingLeft: ROW_PAD }}
        >
          {renaming ? (
            <div className="flex-1 py-0.5 pr-1">
              {nameInput(
                renameName,
                setRenameName,
                () => commitRename(path, name),
                () => setRenamingPath(null),
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSelect(path)}
                aria-current={active ? "true" : undefined}
                title={entry.relPath}
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left active:scale-[0.99]"
              >
                <FileText
                  size={14}
                  className={`shrink-0 ${active ? "text-accent" : "text-faint"}`}
                  aria-hidden
                />
                <span className="truncate">{name}</span>
              </button>
              {dirty && (
                <span
                  className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted"
                  aria-label="Unsaved changes"
                />
              )}
            </>
          )}
        </div>
      </li>
    );
  }

  const rootDropping = dragOver === root;

  return (
    <nav
      aria-label="Workspace files"
      className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-panel"
    >
      <div className="flex items-center gap-2 px-2 py-2.5 text-xs font-medium uppercase tracking-wide text-faint">
        {showFavorites ? (
          <span className="flex items-center gap-2 px-1">
            <Star size={14} aria-hidden />
            Favorites
          </span>
        ) : (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => root && startCreate(root, "file")}
              disabled={!root}
              title="New file"
              className="rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FilePlus size={15} aria-hidden />
              <span className="sr-only">New file</span>
            </button>
            <button
              type="button"
              onClick={() => root && startCreate(root, "folder")}
              disabled={!root}
              title="New folder"
              className="rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FolderPlus size={15} aria-hidden />
              <span className="sr-only">New folder</span>
            </button>
          </div>
        )}
      </div>

      {!root ? (
        <p className="px-3 py-2 text-sm text-faint">Open a folder to begin.</p>
      ) : (
        <ul
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragOver !== root) setDragOver(root);
          }}
          onDrop={(e) => handleDrop(e, root)}
          onDragEnd={() => setDragOver(null)}
          className={`flex-1 overflow-y-auto px-1.5 pb-2 ${
            rootDropping ? "ring-1 ring-inset ring-accent/40" : ""
          }`}
        >
          {showFavorites ? (
            favoriteEntries.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-faint">
                No favorites yet. Right-click a file or folder to add it.
              </li>
            ) : (
              favoriteEntries.map((entry) => renderFavoriteRow(entry))
            )
          ) : (
            <>
              {creating?.dir === root && (
                <li style={{ paddingLeft: ROW_PAD }} className="py-0.5 pr-1">
                  {nameInput(
                    draftName,
                    setDraftName,
                    commitCreate,
                    cancelCreate,
                    creating.kind === "file" ? "name.md" : "folder name",
                  )}
                </li>
              )}
              {tree.length === 0 && !creating ? (
                <li className="px-2 py-1.5 text-sm text-faint">No markdown files.</li>
              ) : (
                tree.map((node) => renderNode(node))
              )}
            </>
          )}
        </ul>
      )}

      {menu && <ContextMenuView />}
    </nav>
  );

  /** The right-click menu, scoped to the component so it can read state/handlers. */
  function ContextMenuView() {
    if (!menu) return null;
    const { entry, inTree } = menu;
    const fav = favorites.has(entry.relPath);

    const items: {
      key: string;
      icon: React.ReactNode;
      label: string;
      action: () => void;
      danger?: boolean;
    }[] = [];

    if (!entry.isDir) {
      items.push({
        key: "open",
        icon: <FileText size={14} aria-hidden />,
        label: "Open",
        action: () => onSelect(entry.path),
      });
      items.push({
        key: "open-new-tab",
        icon: <SquarePlus size={14} aria-hidden />,
        label: "Open in new tab",
        action: () => onOpenInNewTab(entry.path),
      });
    }
    if (entry.isDir && !inTree) {
      items.push({
        key: "reveal",
        icon: <FolderOpen size={14} aria-hidden />,
        label: "Reveal in tree",
        action: () => revealFolder(entry.path),
      });
    }
    if (entry.isDir && inTree) {
      items.push({
        key: "newfile",
        icon: <FilePlus size={14} aria-hidden />,
        label: "New file",
        action: () => startCreate(entry.path, "file"),
      });
      items.push({
        key: "newfolder",
        icon: <FolderPlus size={14} aria-hidden />,
        label: "New folder",
        action: () => startCreate(entry.path, "folder"),
      });
    }
    items.push({
      key: "rename",
      icon: <Pencil size={14} aria-hidden />,
      label: "Rename",
      action: () => startRename(entry.path, entry.name),
    });
    items.push({
      key: "favorite",
      icon: <Star size={14} fill={fav ? "currentColor" : "none"} aria-hidden />,
      label: fav ? "Remove from favorites" : "Add to favorites",
      action: () => onToggleFavorite(entry.relPath),
    });
    items.push({
      key: "delete",
      icon: <Trash2 size={14} aria-hidden />,
      label: "Delete",
      action: () => onDelete(entry.path),
      danger: true,
    });

    const menuH = items.length * 32 + 8;
    const left = Math.max(4, Math.min(menu.x, window.innerWidth - MENU_W - 4));
    const top = Math.max(4, Math.min(menu.y, window.innerHeight - menuH - 4));

    return (
      <ul
        role="menu"
        style={{ left, top, minWidth: MENU_W }}
        className="fixed z-50 overflow-hidden rounded-lg border border-line bg-card py-1 text-sm shadow-popover"
      >
        {items.map((it) => (
          <li key={it.key} role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                it.action();
                setMenu(null);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left active:scale-[0.99] ${
                it.danger
                  ? "text-danger hover:bg-danger/10"
                  : "text-ink hover:bg-hover"
              }`}
            >
              <span className="shrink-0">{it.icon}</span>
              <span className="truncate">{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }
}
