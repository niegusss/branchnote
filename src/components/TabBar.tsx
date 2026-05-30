import { PanelRightClose, PanelRightOpen, Plus, X } from "lucide-react";

export interface TabView {
  id: string;
  /** File name, or null for an empty "new" tab. */
  name: string | null;
  dirty: boolean;
  active: boolean;
}

interface TabBarProps {
  tabs: TabView[];
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
  previewVisible: boolean;
  onTogglePreview: () => void;
}

/** Horizontal strip of open editor tabs, sitting atop the editor column. */
export function TabBar({
  tabs,
  onSelect,
  onClose,
  onNewTab,
  previewVisible,
  onTogglePreview,
}: TabBarProps) {
  const editorBtn =
    "flex items-center justify-center rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-40";
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

      <div className="ml-auto flex shrink-0 items-center gap-0.5 border-l border-line px-1.5">
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
