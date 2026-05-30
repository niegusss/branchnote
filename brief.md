# Project Brief — AI-Native Markdown Workspace - Codename: Branchnote

## Project Goal

Build a minimal, open-source, desktop-only markdown workspace focused on:

* local-first file management
* git-based synchronization
* AI-assisted markdown workflows
* zero backend infrastructure
* user-owned data
* simplicity over feature bloat

The application is intended primarily for:

* learning
* experimentation
* OSS portfolio value
* practical AI + desktop architecture experience

This is NOT intended to compete with full knowledge management platforms like Obsidian or Notion.

Core philosophy:

* markdown files are the source of truth
* git repositories are the sync layer
* user owns all files and API keys
* app should remain lightweight and understandable

---

# High-Level Product Definition

A desktop application built with:

* Tauri
* React
* TypeScript

The app allows users to:

* open a local markdown folder
* browse markdown files
* edit markdown
* preview rendered HTML
* sync changes through git
* connect their own LLM API keys
* run simple AI actions on markdown content

No cloud backend.
No proprietary storage.
No user accounts.

---

# Core Product Principles

## 1. Local-first

All files exist locally on the user's machine.

The app should never require:

* cloud storage
* remote database
* login/account system

The application operates directly on filesystem folders.

---

## 2. Git-native Sync

Git is the synchronization mechanism.

Git is NOT hidden from the user.

The app should expose:

* current repo status
* changed files
* latest commits
* pull/push operations
* merge conflict states

The app should NOT attempt to abstract git into a fake realtime sync system.

---

## 3. Minimal AI Layer

AI is an assistant feature, not the center of the architecture.

The app should support:

* BYOK (Bring Your Own Key)
* simple provider abstraction
* text-based operations only

No:

* agents
* autonomous workflows
* RAG
* vector databases
* MCP
* memory systems
* embeddings
* fine-tuning

---

## 4. Small Scope

Every feature must justify its complexity.

The project intentionally avoids:

* plugin systems
* collaboration
* realtime sync
* WYSIWYG editing
* browser deployment
* mobile support
* complex workspace management

---

# MVP Scope

## Included Features

### Filesystem

* open local folder
* recursive markdown file discovery
* create markdown file
* rename markdown file
* delete markdown file
* save file changes
* watch filesystem changes

Supported extensions:

* `.md`
* `.markdown`

---

### Markdown Editor

* plain markdown editing
* syntax highlighting
* split view:

  * editor
  * HTML preview

No rich text editing.

Preferred editor:

* CodeMirror

---

### HTML Rendering

* markdown → HTML rendering
* safe HTML sanitization
* support:

  * headings
  * lists
  * tables
  * code blocks
  * links
  * images

No custom markdown dialect.

---

### Git Integration

Supported operations:

* initialize repository
* detect existing repository
* git status
* commit all changes
* pull
* push

Authentication:

* Personal Access Token
* SSH

No advanced git features:

* no rebase UI
* no branch management
* no cherry-pick
* no stash UI

---

### AI Features

Initial providers:

* OpenAI
* Anthropic

Simple operations only:

* summarize note
* rewrite note
* generate title
* generate tags

AI operates only on current markdown content.

No repo-wide AI processing in MVP.

---

### Settings

Configurable:

* default workspace folder
* git remote URL
* AI provider selection
* API keys
* theme preference

API keys stored locally only.

---

# Explicit Non-Goals

The following are intentionally excluded from MVP:

* realtime collaboration
* cloud sync backend
* user accounts
* plugin ecosystem
* vector search
* semantic search
* embeddings
* knowledge graph
* AI agents
* autonomous AI actions
* mobile app
* browser/web version
* WYSIWYG editor
* rich document editor
* multi-window architecture
* workspace sharing
* note publishing platform

---

# Recommended Technical Stack

## Desktop

* Tauri

## Frontend

* React
* TypeScript
* Vite
* TailwindCSS

## Editor

* CodeMirror

## Markdown Processing

* remark
* rehype

## Git

Rust:

* git2
* libgit2

Avoid shelling out to git CLI where possible.

---

# Suggested Architecture

## Frontend Layer

Responsibilities:

* UI rendering
* editor state
* user interactions
* settings management

No business logic duplication.

---

## Core Application Layer

Responsibilities:

* filesystem operations
* git operations
* markdown processing
* AI provider orchestration

Should remain framework-independent where possible.

---

## AI Layer

Simple provider abstraction.

Example:

```ts
interface LLMProvider {
  generate(prompt: string): Promise<string>
}
```

Keep this layer extremely small.

---

# UX Philosophy

The app should feel:

* minimal
* predictable
* transparent
* developer-oriented

The app should NOT:

* hide technical concepts
* pretend git is magic sync
* over-automate workflows

Users should understand:

* where files live
* how sync works
* when commits happen
* when conflicts occur

---

# Performance Goals

The app should:

* start quickly
* use minimal RAM
* remain responsive with large markdown collections

Avoid:

* unnecessary abstractions
* massive dependency chains
* hidden background indexing systems

---

# Open Source Goals

The repository should prioritize:

* readability
* maintainability
* modularity

Architecture should remain understandable to contributors.

Avoid:

* AI-generated architecture sprawl
* deeply nested abstractions
* premature optimization

---

# Development Rules

## Important Constraints

* keep modules small
* avoid premature abstractions
* avoid feature creep
* prefer explicitness over magic
* prefer boring solutions over clever ones

---

# Future Possibilities (NOT MVP)

Possible future additions:

* repo-wide AI operations
* semantic note linking
* wiki/static export
* git history visualization
* offline AI model support
* local embedding search

These should not influence MVP architecture prematurely.

---

# Primary Success Criteria

The MVP is successful if it:

* reliably edits markdown files
* safely syncs with git remotes
* performs simple AI actions
* remains understandable and maintainable
* works fully offline except AI/sync operations
* feels lightweight and fast
