import { useState } from "react";
import { FilePlus, FolderOpen, FolderPlus, Star } from "lucide-react";
import type { FileEntry } from "../types";
import { textInput } from "../lib/ui";

interface StartViewProps {
  /** Favorited files (folders excluded) for quick-open. */
  favoriteFiles: FileEntry[];
  onCreateFile: (name: string) => void;
  onCreateFolder: (name: string) => void;
  onOpenFile: (path: string) => void;
  onChangeVault: () => void;
}

/** Empty-tab landing: create things, jump to favorites, or change vault. */
export function StartView({
  favoriteFiles,
  onCreateFile,
  onCreateFolder,
  onOpenFile,
  onChangeVault,
}: StartViewProps) {
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [name, setName] = useState("");

  function start(kind: "file" | "folder") {
    setCreating(kind);
    setName("");
  }

  function commit() {
    const trimmed = name.trim();
    if (trimmed && creating) {
      if (creating === "file") onCreateFile(trimmed);
      else onCreateFolder(trimmed);
    }
    setCreating(null);
    setName("");
  }

  function cancel() {
    setCreating(null);
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

        {creating ? (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
              {creating === "file" ? "New file name" : "New folder name"}
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
              placeholder={creating === "file" ? "name.md" : "folder name"}
              className={textInput}
            />
          </div>
        ) : (
          <div className="mb-5 flex flex-col gap-0.5">
            <button type="button" onClick={() => start("file")} className={action}>
              <FilePlus size={16} aria-hidden />
              New file
            </button>
            <button type="button" onClick={() => start("folder")} className={action}>
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
