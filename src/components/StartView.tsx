import { useState } from "react";
import { FilePlus, FolderOpen, FolderPlus, LayoutTemplate, Star } from "lucide-react";
import type { FileEntry } from "../types";
import { textInput } from "../lib/ui";
import { TemplatePicker } from "./TemplatePicker";

interface StartViewProps {
  /** Favorited files (folders excluded) for quick-open. */
  favoriteFiles: FileEntry[];
  /** User template files (under `templates/`) for the New-from-template menu. */
  templateFiles: FileEntry[];
  /** Create a default-named note and open it (named via the editor title). */
  onCreateUntitled: () => void;
  /** Create a note from a template body (placeholders applied upstream). */
  onNewFromTemplate: (rawBody: string) => void;
  onCreateFolder: (name: string) => void;
  onOpenFile: (path: string) => void;
  onChangeVault: () => void;
}

/** Empty-tab landing: create things, jump to favorites, or change vault. */
export function StartView({
  favoriteFiles,
  templateFiles,
  onCreateUntitled,
  onNewFromTemplate,
  onCreateFolder,
  onOpenFile,
  onChangeVault,
}: StartViewProps) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [name, setName] = useState("");

  function commit() {
    const trimmed = name.trim();
    if (trimmed) onCreateFolder(trimmed);
    setCreatingFolder(false);
    setName("");
  }

  function cancel() {
    setCreatingFolder(false);
    setName("");
  }

  const action =
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-bg p-6">
      <div className="w-full max-w-sm">
        <h2 className="text-base font-semibold text-ink">New tab</h2>
        <p className="mb-5 mt-1 text-sm text-muted">
          Create something, open a favorite, or pick another vault.
        </p>

        {creatingFolder ? (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
              New folder name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              placeholder="folder name"
              className={textInput}
            />
          </div>
        ) : (
          <div className="mb-5 flex flex-col gap-0.5">
            <button type="button" onClick={onCreateUntitled} className={action}>
              <FilePlus size={16} aria-hidden />
              New file
            </button>
            <TemplatePicker
              templateFiles={templateFiles}
              onPick={onNewFromTemplate}
              triggerClassName={action}
              triggerContent={
                <>
                  <LayoutTemplate size={16} aria-hidden />
                  New from template
                </>
              }
            />
            <button
              type="button"
              onClick={() => {
                setCreatingFolder(true);
                setName("");
              }}
              className={action}
            >
              <FolderPlus size={16} aria-hidden />
              New folder
            </button>
            <button type="button" onClick={onChangeVault} className={action}>
              <FolderOpen size={16} aria-hidden />
              Change vault
            </button>
          </div>
        )}

        {favoriteFiles.length > 0 && (
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-faint">
              <Star size={13} aria-hidden />
              Favorites
            </h3>
            <ul className="flex flex-col">
              {favoriteFiles.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => onOpenFile(f.path)}
                    title={f.relPath}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-ink transition-colors hover:bg-hover active:scale-[0.99]"
                  >
                    <span className="truncate">{f.name}</span>
                    {f.relPath.includes("/") && (
                      <span className="truncate text-xs text-faint">
                        {f.relPath.slice(0, f.relPath.lastIndexOf("/"))}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
