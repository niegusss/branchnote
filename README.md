# Branchnote

A **Git-native specification workspace for AI coding agents** — a desktop *control plane*
between human intent and AI implementation. You author, review, approve, and track
**specs**; an **external** coding agent (Claude Code, aider, Codex, Gemini CLI) does the
implementing. Branchnote is **not** the agent — it's the place a human stays in control of
the spec-driven loop. Built with [Tauri](https://tauri.app/), React and TypeScript on a
plain-files, Git-as-the-truth foundation.

> ### 🧪 An experimental, educational project
>
> Branchnote is a **learning and portfolio project**, not a commercial product. It exists
> to study two things hands-on: desktop application architecture (Tauri / Rust + React /
> TypeScript), and **spec-driven development with AI coding agents**.
>
> The implementation was **written by Claude Opus 4.8** (Anthropic) acting as a
> pair-programming agent, under my direction: I owned the **architecture and design
> decisions**, the product direction, and the **review, control, and testing** of every
> change. There is a deliberate symmetry here — a tool about keeping a human in control of
> AI-driven implementation, itself built exactly that way.

> **Status:** active development on the `pivot/spec-driven-dev` branch. The full
> spec-driven loop (create → review → plan → hand off → track → trace) and the underlying
> markdown + Git substrate (editor, tabs, tree, preview, staging, commit, pull/push) are
> implemented and usable.

---

## The idea

AI coding agents are good at *implementing*. They are much less trustworthy when the
*intent* is vague — "vibe coding" produces fast, unreviewable, unaccountable change.
**Spec-Driven Development (SDD)** answers this by making the specification the primary
artifact: you describe *what* and *why*, the agent handles *how*, and every step is a
reviewable file under Git.

GitHub's [Spec Kit](https://github.com/github/spec-kit) brought SDD into the terminal as
slash-commands inside the agent. Branchnote explores the **other half of the same loop**:
the *human control plane* the terminal doesn't give you well — a visual surface to see all
your specs at once, review and approve them, watch task progress, and trace which commit
implemented which task. It is **agent-agnostic** and adopts the emerging
[Spec Kit](https://github.com/github/spec-kit)-minimal convention
(`spec.md` / `plan.md` / `tasks.md`) rather than inventing a proprietary format.

### How it relates to Spec Kit

|  | **Spec Kit** | **Branchnote** |
|--|--------------|----------------|
| Form | CLI + slash-commands *inside* the agent | Desktop GUI *alongside* the agent |
| Role | Generates specs and drives implementation | Human reviews, approves, tracks, traces |
| Spec format | Defines the convention | Consumes it (Spec Kit-minimal as canon) |
| Where it runs | Terminal / agent-native | A window where you stay in control |

They are complementary, not competing: Spec Kit (or any agent) can generate the artifacts;
Branchnote is where a person reviews and governs them.

## The spec workflow

```
Idea → Generate Spec → Review → Approve → Generate Plan → Approve → Execute (agent) → Verify
```

- **Specs are the navigation unit.** The left panel lists every `specs/SPEC-NNN-*` in the
  project with its status, progress, and structure — the spec, not the file, is what you
  browse.
- **`status` ≠ `progress`.** `status ∈ {draft, active, done}` is your declaration in the
  spec's frontmatter; `progress` is derived from `tasks.md`. They're independent — only a
  non-blocking soft warning fires when you mark something `done` while tasks remain.
- **Filesystem is the single source of truth.** The Rust `SpecEngine` is *stateless* —
  pure projections over the files on disk, no hidden index or cache. Validation, progress,
  and structure are deterministic, never inferred.

## Features

### Spec-driven development

- 🧭 **Specs panel** — every spec in the project as a collapsible row: id, title, an
  inline status selector, a progress bar (`done / total` from `tasks.md`), and a soft
  warning when `status = done` but tasks remain. The spec is the primary navigation unit.
- ➕ **Create specs** — *New spec* scaffolds `specs/SPEC-NNN-slug/{spec,plan,tasks}.md`
  from the canonical Spec Kit-minimal template, with auto-numbering and frontmatter
  (`id, title, status, template, created, updated`).
- ☑️ **Interactive tasks** — clicking a checkbox in the preview toggles the underlying
  `- [ ]` / `- [x]` in the file, and the progress bar recomputes. No hand-editing markers.
- 🚀 **Hand off to agent** — composes a context package (`handoff.md`) from the spec, plan,
  and tasks, copies it to the clipboard, opens it for review, and launches a terminal in
  the project — turning Branchnote into a launchpad for `claude` / `aider`. **Rich handoff,
  zero model calls** — Branchnote never calls an LLM itself.
- 🔗 **Traceability** — a dedicated view maps **spec → task → commit** across the project,
  driven by a lightweight reference convention in commit messages (`SPEC-001 T003: …`). See
  which commits implement which spec, with task tags and timestamps.

### Markdown & Git substrate

- 📂 **Project workspace** — open any folder; the project *is* the unit (recent-projects
  list + switcher). Recursive discovery of `.md` / `.markdown`.
- 🗂️ **File tree** — nested folders, collapse, drag-and-drop move, a right-click context
  menu (open / new / rename / delete / reveal in OS explorer), and nesting guide lines.
- 🧾 **Editor tabs + auto-save** — open multiple files; edits flush to disk automatically
  (debounced) and on every tab switch; `Ctrl/Cmd+S` forces an immediate save.
- ✍️ **Markdown editor** — [CodeMirror 6](https://codemirror.dev/) with syntax
  highlighting, line numbers, soft-wrap, and **find/replace** (`Ctrl/Cmd+F`).
- 👁️ **Live preview** — sanitized HTML (GitHub-flavored markdown: headings, lists, tables,
  task lists, code, links, images), toggleable.
- ⚡ **Command palette** — `Ctrl/Cmd+P` for quick actions (new spec / file / folder, open
  views, git pull/push, switch project, …) over a file search.
- 🕸️ **Graph & main-view switcher** — switch the main area between **Editor**, a
  force-directed **Graph** of `[[wikilinks]]`, and the **Traceability** view.
- 🔗 **Wikilinks** — `[[Note]]` links between notes with `[[`-autocomplete and
  click-to-open (or create) in the preview.
- 🔁 **Git** — detect/init, status, a full **staging area** (stage/unstage per file or
  all), commit, and **pull/push** with **ahead/behind counts** (via `git2`/`libgit2`, no
  CLI shelling). **Sign in with GitHub** (OAuth device flow) *or* SSH; token in the **OS
  keychain**.
- 🤖 **Open terminal in project** — one click opens your OS terminal in the project folder,
  ready to run the agent of your choice.
- 🔔 **Toasts**, 🎨 **Light / Dark / System theming**, 🪟 **frameless window** with a custom
  title bar and an icon rail, and 💿 **persistence** of project, recents, and preferences.

## Bring your own agent

Branchnote has **no built-in AI**, on purpose. Your specs and notes are plain files, so the
most capable assistant is a real agent running against them — far more capable (multi-file,
repo- and Git-aware) than any in-app button, and you keep full control of your own keys.

*Hand off to agent* (on a spec) or *Open terminal* drops you into the project folder; then
run your tool of choice:

```bash
claude        # Claude Code
aider         # aider
```

Edits the agent makes land as ordinary file changes — they show up live in the editor and
the Git panel, where you review, stage, and commit them. Commit with a `SPEC-001 T003:`
prefix and the Traceability view links the work back to the spec automatically.

## Tech stack

| Layer | Technology |
|------|------------|
| Desktop shell | Tauri 2 (Rust core + system WebView) |
| Frontend | React 19, TypeScript 5.8, Vite 7 |
| Styling | TailwindCSS 3 (CSS-variable design tokens), Inter |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-markdown`) |
| Preview | `react-markdown` + `remark-gfm` + `rehype-sanitize` |
| Graph | `d3-force` |
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

### Install & run

```bash
git clone https://github.com/niegusss/branchnote.git
cd branchnote
npm install

npm run tauri dev      # launch the desktop app with hot reload
npm run dev            # Vite frontend only (UI iteration in a browser)
npm run tauri build    # produce a platform installer/binary
```

## Project structure

```
branchnote/
├─ src/                     # React + TypeScript frontend
│  ├─ App.tsx               # app shell + state orchestration (tabs, project, git, specs)
│  ├─ components/           # TitleBar, Rail, Sidebar, SpecsPanel, TraceabilityView,
│  │                        # ProjectSwitcher, TabBar, EditorPane, PreviewPane, GitPanel,
│  │                        # GraphView, StartView, Toast, Settings, Onboarding, …
│  └─ lib/                  # workspace + git (Tauri IPC), specs, tasks, tree, gitTree,
│                           # graph, templates, wikilinks, menuNav, theme, editorTheme, ui
└─ src-tauri/               # Rust core (Tauri)
   ├─ src/specs.rs          # stateless SpecEngine: create/scan specs, status, handoff
   ├─ src/git.rs            # git via libgit2 (status/stage/commit/pull/push, spec↔commit refs)
   ├─ src/fs.rs             # filesystem commands (+ open terminal / reveal in explorer)
   ├─ src/watcher.rs        # debounced filesystem watching → "workspace-changed" events
   ├─ src/lib.rs            # command registration / app setup
   ├─ capabilities/         # Tauri permission capabilities
   └─ tauri.conf.json       # window + bundle configuration
```

The frontend talks to the Rust core through typed IPC wrappers in `src/lib/workspace.ts`
and `src/lib/git.ts`; heavy filesystem, spec, and git logic lives in the Rust layer and is
covered by `cargo test`.

## Keyboard shortcuts

| Shortcut | Action |
|---------|--------|
| `Ctrl` / `Cmd` + `S` | Save the active file immediately |
| `Ctrl` / `Cmd` + `P` | Command palette — actions + file search |
| `Ctrl` / `Cmd` + `F` | Find / replace in the editor |
| `Ctrl` / `Cmd` + `Shift` + `F` | Toggle focus mode |
| `Ctrl` / `Cmd` + `Enter` | Commit the staged changes (in the commit box) |

## Data & privacy

- Specs and notes are ordinary files in your chosen project folder — Branchnote never
  copies them elsewhere.
- UI preferences (project path, recents, theme, panel state) are stored in the app's local
  `localStorage`.
- No telemetry, no accounts, no built-in AI, and no network calls until you opt into Git
  sync with your own credentials. Any AI you use runs in your own terminal, under your own
  keys, outside the app.

## Roadmap

- [x] **Phase 1** — Spec templates + create (stateless `SpecEngine`, Spec Kit-minimal)
- [x] **Phase 2** — Specs as primary navigation (left-panel Specs view)
- [x] **Phase 3** — Interactive task checkboxes (toggle `tasks.md` from the preview)
- [x] **Phase 4** — Agent handoff (context package + clipboard + terminal launchpad)
- [x] **Phase 5** — Traceability (spec → task → commit from commit-message refs)
- [ ] Kiro spec-format adapter
- [ ] Requirement-level traceability (requirement → task → commit)
- [ ] Optional `InferenceProvider` for **enrichment/suggestions only** — never touching
      the deterministic invariants (control-plane / data-plane split)

Explicit non-goals: built-in / bundled AI (use an external agent on the files instead),
embedded agent orchestration / terminal emulation / MCP hosting, realtime collaboration,
cloud backend, accounts, plugin ecosystem, mobile or browser versions, WYSIWYG editing.

## Acknowledgements

- Methodology and the canonical spec format follow GitHub's
  [Spec Kit](https://github.com/github/spec-kit).
- The code was authored by **Claude Opus 4.8** under human architectural direction,
  review, and testing (see the note at the top).

## Contributing

This is primarily a personal learning project, but issues and pull requests are welcome.
The codebase favors small modules, explicitness over cleverness, and a lean dependency
surface — please keep changes in that spirit.

## License

Open source — MIT intended (a `LICENSE` file will be added).
