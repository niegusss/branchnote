import {
  FileText,
  Maximize2,
  Minimize2,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Waypoints,
  X,
} from "lucide-react";

export interface TabView {
  id: string;
  /** File name, or null for an empty "new" tab. */
  name: string | null;
  dirty: boolean;
  active: boolean;
}

/** Which view fills the main content area. Mirrors `App`'s `MainView`. */
export type MainView = "editor" | "graph" | "trace";

interface TabBarProps {
  tabs: TabView[];
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
  /** The active main-area view; the segmented switcher reflects/sets it. */
  mainView: MainView;
  onSetMainView: (view: MainView) => void;
  previewVisible: boolean;
  onTogglePreview: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

/** Horizontal strip of open editor tabs, sitting atop the editor column. */
export function TabBar({
  tabs,
  onSelect,
  onClose,
  onNewTab,
  mainView,
  onSetMainView,
  previewVisible,
  onTogglePreview,
  focusMode,
  onToggleFocusMode,
}: TabBarProps) {
  const editorBtn =
    "flex items-center justify-center rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";

  // Segmented switcher for the main-area view (Editor / Graph / Traceability).
  const views: { id: MainView; label: string; Icon: typeof FileText }[] = [
    { id: "editor", label: "Editor", Icon: FileText },
    { id: "graph", label: "Graph", Icon: Network },
    { id: "trace", label: "Traceability", Icon: Waypoints },
  ];
  const segBtn = (active: boolean) =>
    `flex items-center justify-center rounded-md p-1.5 transition-colors active:scale-95 ${
      active ? "bg-accent/10 text-accent" : "text-muted hover:bg-hover hover:text-ink"
    }`;
  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-line bg-panel">
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.active}
            onClick={() => onSelect(tab.id)}
            onAuxClick={(e) => {
              // Middle-click closes, like a browser.
              if (e.button === 1) {
                e.preventDefault();
                onClose(tab.id);
              }
            }}
            className={`group flex max-w-[12rem] shrink-0 cursor-pointer items-center gap-2 border-r border-line px-3 text-sm transition-colors ${
              tab.active
                ? "bg-bg text-ink shadow-[inset_0_2px_0_0_rgb(var(--color-accent))]"
                : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            <span className="truncate">{tab.name ?? "New tab"}</span>
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              {tab.dirty && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-muted group-hover:hidden"
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                title="Close tab"
                className="absolute inset-0 hidden items-center justify-center rounded text-faint hover:bg-line hover:text-ink group-hover:flex"
              >
                <X size={13} aria-hidden />
                <span className="sr-only">Close {tab.name ?? "tab"}</span>
              </button>
            </span>
          </div>
        ))}
        <button
          type="button"
          onClick={onNewTab}
          title="New tab"
          className="flex shrink-0 items-center px-2.5 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95"
        >
          <Plus size={16} aria-hidden />
          <span className="sr-only">New tab</span>
        </button>
      </div>

      <div
        role="group"
        aria-label="Main view"
        className="ml-auto flex shrink-0 items-center gap-0.5 border-l border-line px-1.5"
      >
        {views.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSetMainView(id)}
            title={label}
            aria-pressed={mainView === id}
            className={segBtn(mainView === id)}
          >
            <Icon size={16} aria-hidden />
            <span className="sr-only">{label}</span>
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-line px-1.5">
        <button
          type="button"
          onClick={onToggleFocusMode}
          title={focusMode ? "Exit focus mode (Ctrl+Shift+F)" : "Focus mode (Ctrl+Shift+F)"}
          aria-pressed={focusMode}
          className={editorBtn}
        >
          {focusMode ? (
            <Minimize2 size={16} aria-hidden />
          ) : (
            <Maximize2 size={16} aria-hidden />
          )}
          <span className="sr-only">
            {focusMode ? "Exit focus mode" : "Focus mode"}
          </span>
        </button>
        <button
          type="button"
          onClick={onTogglePreview}
          title={previewVisible ? "Hide preview" : "Show preview"}
          aria-pressed={previewVisible}
          className={editorBtn}
        >
          {previewVisible ? (
            <PanelRightClose size={16} aria-hidden />
          ) : (
            <PanelRightOpen size={16} aria-hidden />
          )}
          <span className="sr-only">
            {previewVisible ? "Hide preview" : "Show preview"}
          </span>
        </button>
      </div>
    </div>
  );
}
