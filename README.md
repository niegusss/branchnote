# Branchnote

A minimal, **local-first**, desktop markdown workspace. Your notes are plain `.md`
files on your disk, **git** is the visible sync layer, and a thin **bring-your-own-key**
AI assist is layered on top — nothing more. Branchnote is built with
[Tauri](https://tauri.app/), React and TypeScript, and is intentionally small: it is not
trying to replace Obsidian or Notion.

> **Status:** early development. The editing experience (filesystem, tabs, tree, preview,
> theming, window chrome) is implemented and usable. **Git sync** and **AI actions** are
> on the roadmap below and not wired up yet.

---

## Why Branchnote

- **Local-first** — every note is a real file in a folder you choose (a *vault*). No cloud,
  no account, no database, no lock-in.
- **Git is not hidden** — sync is plain git (status / commit / pull / push), surfaced
  honestly instead of pretending to be magic realtime sync.
- **Explicit over magic** — you always know where files live and when things are written.
- **Lightweight** — a small dependency surface and a Rust core; fast start, low memory.
- **You own your keys** — AI is optional, uses your own provider API key, and only ever
  operates on the note in front of you.

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
  highlighting, line numbers and soft-wrap.
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

**Planned** (see [Roadmap](#roadmap))

- 🔁 **Git sync** — repo status, commit-all, pull, push (PAT + SSH) via `git2`/`libgit2`.
- 🤖 **AI actions** (BYOK) — summarize / rewrite / generate title / generate tags, OpenAI &
  Anthropic, on the current note only.

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
| Git *(planned)* | `git2` / `libgit2` |

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
│  ├─ App.tsx               # app shell + state orchestration (tabs, vault, theme)
│  ├─ components/           # TitleBar, Rail, Sidebar, TabBar, EditorPane,
│  │                        # PreviewPane, StartView, StatusBar, Settings, Onboarding
│  └─ lib/                  # workspace (Tauri IPC), tree, theme, editorTheme, ui
└─ src-tauri/               # Rust core (Tauri)
   ├─ src/fs.rs             # filesystem commands (list/read/save/create/rename/delete/move)
   ├─ src/watcher.rs        # debounced filesystem watching → "workspace-changed" events
   ├─ src/lib.rs            # command registration / app setup
   ├─ capabilities/         # Tauri permission capabilities
   └─ tauri.conf.json       # window + bundle configuration
```

The frontend talks to the Rust core through typed IPC wrappers in
`src/lib/workspace.ts`; heavy filesystem logic lives in the Rust layer.

## Keyboard shortcuts

| Shortcut | Action |
|---------|--------|
| `Ctrl` / `Cmd` + `S` | Save the active note immediately |

## Data & privacy

- Notes are ordinary files in your chosen vault folder — Branchnote never copies them
  elsewhere.
- UI preferences (vault path, theme, sidebar/preview state, favorites) are stored in the
  app's local `localStorage`.
- No telemetry, no accounts, no network calls (until you opt into git sync or AI with your
  own credentials).

## Roadmap

- [ ] Git integration: init/detect repo, status, commit-all, pull, push (PAT + SSH)
- [ ] BYOK AI actions: summarize, rewrite, generate title, generate tags (OpenAI + Anthropic)
- [ ] Settings: git remote, AI provider + API keys (stored locally)
- [ ] Move sensitive persistence (tokens/keys) to a Rust-backed store

Explicit non-goals: realtime collaboration, cloud backend, accounts, plugin ecosystem,
vector/semantic search, AI agents, mobile or browser versions, WYSIWYG editing.

## Contributing

Issues and pull requests are welcome. The codebase favors small modules, explicitness over
cleverness, and keeping the dependency surface lean — please keep changes in that spirit.

## License

Open source — MIT intended (a `LICENSE` file will be added).
