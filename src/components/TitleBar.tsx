import { useEffect, useState } from "react";
import { ChevronDown, Copy, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ProjectSwitcher } from "./ProjectSwitcher";

interface TitleBarProps {
  /** Open vault name, or null on the onboarding screen. */
  vaultName: string | null;
  /** Absolute path of the open project (vault), or null. */
  vaultPath: string | null;
  /** Recently-opened project paths, most-recent-first. */
  recents: string[];
  /** Open one of the recent projects. */
  onOpenProject: (path: string) => void;
  /** Open the folder picker to choose a (possibly new) project. */
  onPickProject: () => void;
  /** Active file name, or null. */
  fileName: string | null;
  dirty: boolean;
}

const appWindow = getCurrentWindow();

/** Custom frameless title bar: drag region, breadcrumb, and window controls. */
export function TitleBar({
  vaultName,
  vaultPath,
  recents,
  onOpenProject,
  onPickProject,
  fileName,
  dirty,
}: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void appWindow.isMaximized().then((m) => !cancelled && setMaximized(m));
    appWindow
      .onResized(() => {
        void appWindow.isMaximized().then((m) => !cancelled && setMaximized(m));
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const control =
    "flex h-full w-12 items-center justify-center text-muted transition-colors hover:bg-hover hover:text-ink";

  return (
    <header
      data-tauri-drag-region
      className="flex h-10 shrink-0 select-none items-center border-b border-line bg-panel pl-3"
    >
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-sm font-semibold tracking-tight text-ink">
          Branchnote
        </span>
        {vaultName && (
          <span className="flex min-w-0 items-center gap-1 text-sm text-faint">
            <ProjectSwitcher
              current={vaultPath}
              recents={recents}
              onOpenProject={onOpenProject}
              onPickProject={onPickProject}
              triggerTitle="Switch project"
              triggerClassName="flex max-w-[16rem] items-center gap-1 rounded-md px-1.5 py-0.5 text-muted transition-colors hover:bg-hover hover:text-ink"
              triggerContent={
                <>
                  <span className="truncate">{vaultName}</span>
                  <ChevronDown size={13} className="shrink-0 text-faint" aria-hidden />
                </>
              }
            />
            {fileName && (
              <>
                <span aria-hidden>/</span>
                <span className="truncate text-muted">{fileName}</span>
                {dirty && <span className="shrink-0 text-accent">•</span>}
              </>
            )}
          </span>
        )}
      </div>

      <div className="flex h-full shrink-0 items-stretch">
        <button
          type="button"
          onClick={() => void appWindow.minimize()}
          title="Minimize"
          className={control}
        >
          <Minus size={16} aria-hidden />
          <span className="sr-only">Minimize</span>
        </button>
        <button
          type="button"
          onClick={() => void appWindow.toggleMaximize()}
          title={maximized ? "Restore" : "Maximize"}
          className={control}
        >
          {maximized ? <Copy size={13} aria-hidden /> : <Square size={13} aria-hidden />}
          <span className="sr-only">{maximized ? "Restore" : "Maximize"}</span>
        </button>
        <button
          type="button"
          onClick={() => void appWindow.close()}
          title="Close"
          className="flex h-full w-12 items-center justify-center text-muted transition-colors hover:bg-danger hover:text-white"
        >
          <X size={17} aria-hidden />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </header>
  );
}
