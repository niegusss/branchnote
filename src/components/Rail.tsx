import { FilePlus, FolderTree, Settings as SettingsIcon, Star } from "lucide-react";

export type SidebarView = "files" | "favorites";

interface RailProps {
  view: SidebarView;
  sidebarVisible: boolean;
  onActivateView: (view: SidebarView) => void;
  onNewFile: () => void;
  onOpenSettings: () => void;
}

/** Far-left icon rail: quick actions + sidebar view switches. */
export function Rail({
  view,
  sidebarVisible,
  onActivateView,
  onNewFile,
  onOpenSettings,
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
      <button type="button" onClick={onNewFile} title="New file" className={ghost}>
        <FilePlus size={18} aria-hidden />
        <span className="sr-only">New file</span>
      </button>

      <div className="my-1 h-px w-6 bg-line" aria-hidden />

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
