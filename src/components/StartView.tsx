import { useState } from "react";
import {
  ClipboardList,
  FilePlus,
  FolderOpen,
  FolderPlus,
  LayoutTemplate,
  Terminal,
} from "lucide-react";
import type { FileEntry } from "../types";
import { textInput } from "../lib/ui";
import { TemplatePicker } from "./TemplatePicker";

interface StartViewProps {
  /** User template files (under `templates/`) for the New-from-template menu. */
  templateFiles: FileEntry[];
  /** Scaffold a new spec from a title and open its `spec.md`. */
  onCreateSpec: (title: string) => void;
  /** Create a default-named note and open it (named via the editor title). */
  onCreateUntitled: () => void;
  /** Create a note from a template body (placeholders applied upstream). */
  onNewFromTemplate: (rawBody: string) => void;
  onCreateFolder: (name: string) => void;
  /** Open the OS terminal in the project (to run an external agent). */
  onOpenTerminal: () => void;
  /** Open the folder picker to switch projects. */
  onChangeVault: () => void;
}

/** Empty-tab landing, framed around the spec-driven workflow: the first thing a
 *  user reaches for is a spec, not a loose note. */
export function StartView({
  templateFiles,
  onCreateSpec,
  onCreateUntitled,
  onNewFromTemplate,
  onCreateFolder,
  onOpenTerminal,
  onChangeVault,
}: StartViewProps) {
  const [creating, setCreating] = useState<"spec" | "folder" | null>(null);
  const [name, setName] = useState("");

  function commit() {
    const trimmed = name.trim();
    if (trimmed) {
      if (creating === "spec") onCreateSpec(trimmed);
      else if (creating === "folder") onCreateFolder(trimmed);
    }
    setCreating(null);
    setName("");
  }

  function cancel() {
    setCreating(null);
    setName("");
  }

  const action =
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";
  const primaryAction = `${action} text-accent hover:bg-accent/10`;
  const secondaryAction = `${action} text-ink hover:bg-hover`;

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-bg p-6">
      <div className="w-full max-w-sm">
        <h2 className="text-base font-semibold text-ink">Start</h2>
        <p className="mb-5 mt-1 text-sm text-muted">
          Author a spec, draft a note, or hand work to an agent.
        </p>

        {creating ? (
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
              {creating === "spec" ? "New spec title" : "New folder name"}
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
              placeholder={creating === "spec" ? "e.g. User authentication" : "folder name"}
              className={textInput}
            />
          </div>
        ) : (
          <div className="mb-5 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => {
                setCreating("spec");
                setName("");
              }}
              className={primaryAction}
            >
              <ClipboardList size={16} aria-hidden />
              New spec
            </button>
            <button type="button" onClick={onCreateUntitled} className={secondaryAction}>
              <FilePlus size={16} aria-hidden />
              New file
            </button>
            <TemplatePicker
              templateFiles={templateFiles}
              onPick={onNewFromTemplate}
              triggerClassName={secondaryAction}
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
                setCreating("folder");
                setName("");
              }}
              className={secondaryAction}
            >
              <FolderPlus size={16} aria-hidden />
              New folder
            </button>

            <div className="my-1 h-px bg-line" aria-hidden />

            <button type="button" onClick={onOpenTerminal} className={secondaryAction}>
              <Terminal size={16} aria-hidden />
              Open terminal in project
            </button>
            <button type="button" onClick={onChangeVault} className={secondaryAction}>
              <FolderOpen size={16} aria-hidden />
              Open / switch project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
