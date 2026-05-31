import {
  ClipboardList,
  FolderTree,
  GitBranch,
  Network,
  Search,
  Settings as SettingsIcon,
  Star,
} from "lucide-react";

export type SidebarView = "files" | "favorites" | "git" | "specs";

interface RailProps {
  view: SidebarView;
  sidebarVisible: boolean;
  onActivateView: (view: SidebarView) => void;
  onOpenSettings: () => void;
  /** Open the command palette (Ctrl/Cmd+P). */
  onQuickOpen: () => void;
  /** Whether the graph view is showing in the main area. */
  graphActive: boolean;
  onToggleGraph: () => void;
}

/** Far-left icon rail: quick actions + sidebar view switches. */
export function Rail({
  view,
  sidebarVisible,
  onActivateView,
  onOpenSettings,
  onQuickOpen,
  graphActive,
  onToggleGraph,
}: RailProps) {
  const base =
    "flex h-9 w-9 items-center justify-center rounded-md transition-colors active:scale-95";
  const ghost = `${base} text-muted hover:bg-hover hover:text-ink`;
  const railBtn = (active: boolean) =>
    active && sidebarVisible ? `${base} bg-accent/10 text-accent` : ghost;

  return (
    <nav
      aria-label="Activity bar"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-2"
    >
      <button
        type="button"
        onClick={onQuickOpen}
        title="Quick open / commands (Ctrl+P)"
        className={ghost}
      >
        <Search size={18} aria-hidden />
        <span className="sr-only">Quick open</span>
      </button>
      <button
        type="button"
        onClick={() => onActivateView("specs")}
        title="Specs"
        aria-pressed={view === "specs" && sidebarVisible}
        className={railBtn(view === "specs")}
      >
        <ClipboardList size={18} aria-hidden />
        <span className="sr-only">Specs</span>
      </button>
      <button
        type="button"
        onClick={() => onActivateView("files")}
        title="Files"
        aria-pressed={view === "files" && sidebarVisible}
        className={railBtn(view === "files")}
      >
        <FolderTree size={18} aria-hidden />
        <span className="sr-only">Files</span>
      </button>
      <button
        type="button"
        onClick={() => onActivateView("favorites")}
        title="Favorites"
        aria-pressed={view === "favorites" && sidebarVisible}
        className={railBtn(view === "favorites")}
      >
        <Star
          size={18}
          fill={view === "favorites" && sidebarVisible ? "currentColor" : "none"}
          aria-hidden
        />
        <span className="sr-only">Favorites</span>
      </button>
      <button
        type="button"
        onClick={() => onActivateView("git")}
        title="Source control"
        aria-pressed={view === "git" && sidebarVisible}
        className={railBtn(view === "git")}
      >
        <GitBranch size={18} aria-hidden />
        <span className="sr-only">Source control</span>
      </button>
      <button
        type="button"
        onClick={onToggleGraph}
        title="Graph view"
        aria-pressed={graphActive}
        className={graphActive ? `${base} bg-accent/10 text-accent` : ghost}
      >
        <Network size={18} aria-hidden />
        <span className="sr-only">Graph view</span>
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        title="Settings"
        className={`${ghost} mt-auto`}
      >
        <SettingsIcon size={18} aria-hidden />
        <span className="sr-only">Settings</span>
      </button>
    </nav>
  );
}
