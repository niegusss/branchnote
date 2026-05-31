# Branchnote

A minimal, **local-first**, desktop markdown workspace. Your notes are plain `.md`
files on your disk and **git** is the visible sync layer — nothing more. Because the
notes are just files, you can point **any external AI agent** (Claude Code, aider, …)
straight at the folder; Branchnote doesn't bundle its own AI. It's built with
[Tauri](https://tauri.app/), React and TypeScript, and is intentionally small: it is not
trying to replace Obsidian or Notion.

> **Status:** early development. The editing experience (filesystem, tabs, tree, preview,
> theming, window chrome, find/replace, command palette, wikilinks, graph view, focus
> mode) **and the full git workflow** — status, staging, commit, pull/push with
> ahead/behind, GitHub sign-in and SSH — are implemented and usable.

---

## Why Branchnote

- **Local-first** — every note is a real file in a folder you choose (a *vault*). No cloud,
  no account, no database, no lock-in.
- **Git is not hidden** — sync is plain git (status / commit / pull / push), surfaced
  honestly instead of pretending to be magic realtime sync.
- **Explicit over magic** — you always know where files live and when things are written.
- **Lightweight** — a small dependency surface and a Rust core; fast start, low memory.
- **Bring your own agent** — no built-in AI. Your notes are plain files, so the most
  capable assistant is whatever you run in a terminal in the vault (Claude Code, aider,
  …); Branchnote gives you a one-click way to open one there.

## Features

**Available today**

- 📂 **Vault workspace** — open any folder of markdown files; recursive discovery of
  `.md` / `.markdown`.
- 🗂️ **File tree** — nested folders with collapse, **drag-and-drop move**, a right-click
  **context menu** (open / open in new tab / new file / new folder / rename / favorite /
  delete), and nesting guide lines.
- 🧾 **Editor tabs** — open multiple notes; select-to-replace in the active tab or open in
  a new tab.
- 💾 **Auto-save** — edits are flushed to disk automatically (debounced) and on every tab
  switch/close; `Ctrl/Cmd+S` forces an immediate save. No "unsaved changes" dialogs.
- ✍️ **Markdown editor** — [CodeMirror 6](https://codemirror.dev/) with markdown syntax
  highlighting, line numbers, soft-wrap, and **find/replace** (`Ctrl/Cmd+F`).
- ⚡ **Command palette** — `Ctrl/Cmd+P` opens a palette of **quick actions** (new file
  / folder, toggle preview / focus mode / theme, graph, git pull / push, settings,
  change vault) over a **file search**; `Enter` runs/opens (`Ctrl/Cmd+Enter` opens a
  file in a new tab). Also reachable from the left rail.
- 🕸️ **Graph view** — a force-directed graph of your vault: notes are nodes, `[[links]]`
  are edges; pan, zoom, and click a node to open it.
- 🔗 **Wikilinks** — `[[Note]]` (and `[[Note|alias]]`) link between notes; the editor
  autocompletes names after `[[`, and clicking a link in the preview opens the note —
  or creates it if it doesn't exist yet.
- 🎯 **Focus mode** — `Ctrl/Cmd+Shift+F` hides the sidebar and preview to centre the
  editor.
- 👁️ **Live preview** — sanitized HTML preview (GitHub-flavored markdown: headings, lists,
  tables, task lists, code, links, images), toggleable.
- ⭐ **Favorites** — star files/folders per vault, with a favorites-only view and a
  start-view quick-open.
- 🎨 **Theming** — Light / Dark / **System** built on a semantic design-token system, with
  the [Inter](https://rsms.me/inter/) UI font.
- 🪟 **Modern desktop chrome** — frameless window with a custom title bar and an
  Obsidian-style left icon rail.
- 💿 **Persistence** — your vault, theme, sidebar and preview preferences are remembered
  across launches; a default vault is created at `Documents/Branchnote` on first run.
- 📝 **Note titles** — the title is the note's **first line**, always kept as a `#` heading
  (large in preview); the **file name follows that heading** automatically. New notes start
  with `# ` and the cursor ready, so you just type the title.
- 🧩 **Templates** — *New from template* with built-ins (daily note, meeting notes, TODO)
  plus your own `.md` files in a `templates/` folder in the vault; `{{title}}` / `{{date}}`
  / `{{time}}` placeholders are filled on creation.
- ℹ️ **File metadata** — hover a tree row for created/modified dates and, for folders, the
  number of files and subfolders inside.
- 🔁 **Git** — detect/init, status, a full **staging area** (stage/unstage per file or all),
  commit, and **pull/push** with **ahead/behind counts** and a clear "up to date" state
  (via `git2`/`libgit2`, no CLI shelling). **Sign in with GitHub** (OAuth device flow — no
  token copy-pasting) *or* SSH; remote URL + identity live in git config, and the access
  token is stored in your **OS keychain**.
- 🤖 **Open terminal in vault** — one click (Settings → Vault, or the command palette)
  opens your OS terminal in the vault folder, ready to run an AI agent on your notes
  (see [AI / external agents](#ai--external-agents)).

## AI / external agents

Branchnote has **no built-in AI**, on purpose. Your vault is just a folder of `.md`
files, so the best assistant is a real agent running against those files — far more
capable (multi-file, repo- and git-aware) than any in-app "summarize this note" button
would be, and you keep full control of your own keys.

Use **Open terminal** (Settings → Vault, or `Ctrl/Cmd+P` → *Open terminal in vault*),
then run your tool of choice in that folder, e.g.:

```bash
claude        # Claude Code
aider         # aider
```

Edits the agent makes land as ordinary file changes — they show up live in the editor
and in the Git panel, where you review, stage, and commit them like any other change.

## Tech stack

| Layer | Technology |
|------|------------|
| Desktop shell | Tauri 2 (Rust core + system WebView) |
| Frontend | React 19, TypeScript 5.8, Vite 7 |
| Styling | TailwindCSS 3 (CSS-variable design tokens), Inter |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-markdown`) |
| Preview | `react-markdown` + `remark-gfm` + `rehype-sanitize` |
| Icons | `lucide-react` |
| Filesystem watch (Rust) | `notify` + `notify-debouncer-full` |
| Git (Rust) | `git2` / `libgit2`, `keyring` (OS keychain), `ureq` (GitHub device flow) |

## Getting started

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** toolchain (stable) — install via [rustup](https://rustup.rs/)
- Platform build dependencies for Tauri 2 — see the
  [Tauri prerequisites guide](https://tauri.app/start/prerequisites/):
  - **Windows:** Microsoft C++ Build Tools (MSVC) + WebView2 runtime
  - **macOS:** Xcode Command Line Tools
  - **Linux:** `webkit2gtk` and related packages

### Install

```bash
git clone https://github.com/niegusss/branchnote.git
cd branchnote
npm install
```

### Run (development)

```bash
npm run tauri dev      # launch the desktop app with hot reload
```

You can also iterate on the UI in a browser (no native layer / filesystem):

```bash
npm run dev            # Vite frontend only
```

### Build (production)

```bash
npm run tauri build    # produce a platform installer/binary
```

## Project structure

```
branchnote/
├─ src/                     # React + TypeScript frontend
│  ├─ App.tsx               # app shell + state orchestration (tabs, vault, theme, git)
│  ├─ components/           # TitleBar, Rail, Sidebar, TabBar, EditorPane, PreviewPane,
│  │                        # StartView, StatusBar, GitPanel, TemplatePicker, QuickOpen,
│  │                        # GraphView, Settings, Onboarding, ConfirmDialog
│  └─ lib/                  # workspace + git (Tauri IPC), tree, gitTree, graph,
│                           # templates, wikilinks, menuNav, format, theme, editorTheme, ui
└─ src-tauri/               # Rust core (Tauri)
   ├─ src/fs.rs             # filesystem commands (list/read/save/create/rename/delete/move)
   ├─ src/git.rs            # git via libgit2 (status/stage/commit/pull/push, GitHub sign-in)
   ├─ src/watcher.rs        # debounced filesystem watching → "workspace-changed" events
   ├─ src/lib.rs            # command registration / app setup
   ├─ capabilities/         # Tauri permission capabilities
   └─ tauri.conf.json       # window + bundle configuration
```

The frontend talks to the Rust core through typed IPC wrappers in
`src/lib/workspace.ts` and `src/lib/git.ts`; heavy filesystem and git logic lives in the
Rust layer.

## Keyboard shortcuts

| Shortcut | Action |
|---------|--------|
| `Ctrl` / `Cmd` + `S` | Save the active note immediately |
| `Ctrl` / `Cmd` + `P` | Command palette — actions + file search (`Ctrl`/`Cmd`+`Enter` opens a file in a new tab) |
| `Ctrl` / `Cmd` + `F` | Find / replace in the editor |
| `Ctrl` / `Cmd` + `Shift` + `F` | Toggle focus mode (hide sidebar + preview) |
| `Ctrl` / `Cmd` + `Enter` | Commit the staged changes (in the commit box) |

## Data & privacy

- Notes are ordinary files in your chosen vault folder — Branchnote never copies them
  elsewhere.
- UI preferences (vault path, theme, sidebar/preview state, favorites) are stored in the
  app's local `localStorage`.
- No telemetry, no accounts, no built-in AI, and no network calls (until you opt into git
  sync with your own credentials). Any AI you use runs in your own terminal, under your
  own keys, outside the app.

## Roadmap

- [x] Git integration: init/detect repo, status, staging area, commit, pull/push (PAT + SSH
      + GitHub sign-in), ahead/behind, remote + identity in Settings, token in OS keychain
- [x] Markdown templates: built-ins + `templates/` folder, `{{placeholder}}` substitution
- [x] Editor power-ups: command palette (`Ctrl/Cmd+P`), in-note find/replace (`Ctrl/Cmd+F`),
      `[[wikilinks]]` (autocomplete + click-to-open/create), graph view, focus mode
- [x] AI strategy: bring your own external agent — *Open terminal in vault* instead of a
      built-in BYOK integration

Explicit non-goals: built-in / bundled AI (use an external agent on the files instead),
realtime collaboration, cloud backend, accounts, plugin ecosystem,
vector/semantic search, mobile or browser versions, WYSIWYG editing.

## Contributing

Issues and pull requests are welcome. The codebase favors small modules, explicitness over
cleverness, and keeping the dependency surface lean — please keep changes in that spirit.

## License

Open source — MIT intended (a `LICENSE` file will be added).
