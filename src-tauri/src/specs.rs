//! Spec-Driven Development engine.
//!
//! The pivot makes *specifications* the primary object: a spec is a folder
//! `specs/SPEC-NNN-slug/` holding `spec.md` (metadata + content), `plan.md`
//! (execution plan) and `tasks.md` (a GFM task list).
//!
//! **The filesystem is the single source of truth.** This engine is stateless:
//! every function is a pure projection over files on disk (no index, no cache).
//! The only mutations are file writes (`create_spec`, `set_status`). `status`
//! is a human declaration kept in the spec's frontmatter; `progress` is a
//! metric derived from `tasks.md`. The two are intentionally independent — we
//! never enforce that `done` implies 100% (a soft warning lives in the UI).

use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Done/total task counts for a spec (derived from `tasks.md`).
#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SpecProgress {
    pub done: usize,
    pub total: usize,
}

/// A specification as a first-class object. Mirrors the TS `Spec`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Spec {
    /// Stable id, e.g. "SPEC-001".
    pub id: String,
    pub title: String,
    /// Human declaration: "draft" | "active" | "done".
    pub status: String,
    /// Template the spec was scaffolded from, e.g. "spec-kit".
    pub template: String,
    /// Folder path relative to the vault root, forward-slashed.
    pub dir_rel_path: String,
    /// Absolute path to `spec.md` (so the frontend can open it in the editor).
    pub spec_path: String,
    pub progress: SpecProgress,
}

const TEMPLATE: &str = "spec-kit";
const STATUSES: [&str; 3] = ["draft", "active", "done"];

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested below)
// ---------------------------------------------------------------------------

/// Parse a leading `--- … ---` YAML-ish frontmatter block into `key: value`
/// pairs (value = everything after the first colon, trimmed). Returns an empty
/// map when there is no frontmatter.
fn parse_frontmatter(content: &str) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    let mut lines = content.lines();
    // The first non-empty line must be the opening fence.
    match lines.next() {
        Some(l) if l.trim() == "---" => {}
        _ => return out,
    }
    for line in lines {
        if line.trim() == "---" {
            break;
        }
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim();
            if !key.is_empty() {
                out.insert(key.to_string(), value.trim().to_string());
            }
        }
    }
    out
}

/// Classify a single line as a GFM task: `Some(true)` if checked, `Some(false)`
/// if unchecked, `None` if it is not a task list item.
fn task_line(line: &str) -> Option<bool> {
    let trimmed = line.trim_start();
    let rest = ["- [", "* [", "+ ["]
        .iter()
        .find_map(|m| trimmed.strip_prefix(m))?;
    let mut chars = rest.chars();
    let mark = chars.next()?;
    if chars.next()? != ']' {
        return None;
    }
    match mark {
        'x' | 'X' => Some(true),
        ' ' => Some(false),
        _ => None,
    }
}

/// Count done/total tasks in a `tasks.md` body.
fn task_progress(content: &str) -> SpecProgress {
    let mut done = 0;
    let mut total = 0;
    for line in content.lines() {
        if let Some(checked) = task_line(line) {
            total += 1;
            if checked {
                done += 1;
            }
        }
    }
    SpecProgress { done, total }
}

/// Extract the numeric part of a `SPEC-NNN-…` directory name.
fn parse_spec_num(name: &str) -> Option<u32> {
    let rest = name.strip_prefix("SPEC-")?;
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    digits.parse().ok()
}

/// Next free spec number = max existing `SPEC-NNN` under `specs_dir`, plus one
/// (1 when the folder is missing or empty).
fn next_spec_number(specs_dir: &Path) -> u32 {
    let max = fs::read_dir(specs_dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .filter_map(|e| parse_spec_num(&e.file_name().to_string_lossy()))
        .max()
        .unwrap_or(0);
    max + 1
}

/// Turn a title into a URL/file-safe slug (lowercase, non-alphanumerics → `-`).
fn slugify(title: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for c in title.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            prev_dash = false;
        } else if !out.is_empty() && !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}

/// Replace `key:`'s value inside the frontmatter block (inserting the field if
/// it is absent, or prepending a whole block if there is no frontmatter).
fn set_frontmatter_field(content: &str, key: &str, value: &str) -> String {
    let newline = if content.contains("\r\n") { "\r\n" } else { "\n" };
    let mut lines: Vec<String> = content
        .split('\n')
        .map(|l| l.trim_end_matches('\r').to_string())
        .collect();

    let start = lines.iter().position(|l| l.trim() == "---");
    if let Some(s) = start {
        if let Some(rel) = lines[s + 1..].iter().position(|l| l.trim() == "---") {
            let end = s + 1 + rel;
            let prefix = format!("{key}:");
            let mut replaced = false;
            for line in &mut lines[s + 1..end] {
                if line.trim_start().starts_with(&prefix) {
                    *line = format!("{key}: {value}");
                    replaced = true;
                    break;
                }
            }
            if !replaced {
                lines.insert(end, format!("{key}: {value}"));
            }
            return lines.join(newline);
        }
    }
    // No frontmatter present — prepend one.
    format!("---{newline}{key}: {value}{newline}---{newline}{newline}{content}")
}

// ---------------------------------------------------------------------------
// Canonical "Spec Kit minimal" template
// ---------------------------------------------------------------------------

fn spec_md(id: &str, title: &str, today: &str) -> String {
    format!(
        "---\n\
         id: {id}\n\
         title: {title}\n\
         status: draft\n\
         template: {TEMPLATE}\n\
         created: {today}\n\
         updated: {today}\n\
         ---\n\
         \n\
         # {title}\n\
         \n\
         ## Objective\n\
         \n\
         \n\
         ## Scope\n\
         \n\
         \n\
         ## Requirements\n\
         \n\
         - \n\
         \n\
         ## Acceptance Criteria\n\
         \n\
         - \n"
    )
}

fn plan_md(title: &str) -> String {
    format!(
        "# Plan: {title}\n\
         \n\
         ## Approach\n\
         \n\
         \n\
         ## Steps\n\
         \n\
         1. \n\
         \n\
         ## Risks\n\
         \n\
         - \n"
    )
}

fn tasks_md(title: &str) -> String {
    format!(
        "# Tasks: {title}\n\
         \n\
         - [ ] T001 \n\
         - [ ] T002 \n"
    )
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Scaffold a new spec folder under `<root>/specs/` and return it. `today` is
/// an ISO `YYYY-MM-DD` date supplied by the frontend (keeps the core free of a
/// date dependency).
#[tauri::command]
pub fn create_spec(root: String, title: String, today: String) -> Result<Spec, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("Title cannot be empty".into());
    }
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a folder: {root}"));
    }

    let specs_dir = root_path.join("specs");
    fs::create_dir_all(&specs_dir).map_err(|e| e.to_string())?;

    let num = next_spec_number(&specs_dir);
    let id = format!("SPEC-{num:03}");
    let slug = {
        let s = slugify(title);
        if s.is_empty() {
            "untitled".to_string()
        } else {
            s
        }
    };
    let dir_name = format!("{id}-{slug}");
    let dir = specs_dir.join(&dir_name);
    if dir.exists() {
        return Err(format!("{dir_name} already exists"));
    }
    fs::create_dir(&dir).map_err(|e| e.to_string())?;

    let tasks = tasks_md(title);
    fs::write(dir.join("spec.md"), spec_md(&id, title, &today)).map_err(|e| e.to_string())?;
    fs::write(dir.join("plan.md"), plan_md(title)).map_err(|e| e.to_string())?;
    fs::write(dir.join("tasks.md"), &tasks).map_err(|e| e.to_string())?;

    let spec_path = dir.join("spec.md");
    Ok(Spec {
        id,
        title: title.to_string(),
        status: "draft".to_string(),
        template: TEMPLATE.to_string(),
        dir_rel_path: format!("specs/{dir_name}"),
        spec_path: spec_path.to_string_lossy().to_string(),
        progress: task_progress(&tasks),
    })
}

/// Read every `specs/SPEC-NNN-*` folder under `root` and project it to a `Spec`.
/// Pure over the filesystem: no persisted state. Folders without a `spec.md`
/// are skipped. Returns an empty list when there is no `specs/` folder yet.
#[tauri::command]
pub fn scan_specs(root: String) -> Result<Vec<Spec>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a folder: {root}"));
    }
    let specs_dir = root_path.join("specs");
    if !specs_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    for entry in fs::read_dir(&specs_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        if parse_spec_num(&dir_name).is_none() {
            continue;
        }
        let dir = entry.path();
        let spec_md_path = dir.join("spec.md");
        if !spec_md_path.is_file() {
            continue;
        }
        let content = fs::read_to_string(&spec_md_path).map_err(|e| e.to_string())?;
        let fm = parse_frontmatter(&content);

        let tasks = fs::read_to_string(dir.join("tasks.md")).unwrap_or_default();

        out.push(Spec {
            id: fm.get("id").cloned().unwrap_or_else(|| dir_name.clone()),
            title: fm
                .get("title")
                .filter(|t| !t.is_empty())
                .cloned()
                .unwrap_or_else(|| dir_name.clone()),
            status: fm.get("status").cloned().unwrap_or_else(|| "draft".into()),
            template: fm.get("template").cloned().unwrap_or_else(|| TEMPLATE.into()),
            dir_rel_path: format!("specs/{dir_name}"),
            spec_path: spec_md_path.to_string_lossy().to_string(),
            progress: task_progress(&tasks),
        });
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

/// Set a spec's `status` (a human declaration) by rewriting its `spec.md`
/// frontmatter. `today` refreshes the `updated:` field. The file write is the
/// only mutation — the filesystem stays the source of truth.
#[tauri::command]
pub fn set_status(spec_path: String, status: String, today: String) -> Result<(), String> {
    if !STATUSES.contains(&status.as_str()) {
        return Err(format!("Invalid status: {status}"));
    }
    let path = PathBuf::from(&spec_path);
    let content = fs::read_to_string(&path).map_err(|e| format!("Could not read {spec_path}: {e}"))?;
    let updated = set_frontmatter_field(&content, "status", &status);
    let updated = set_frontmatter_field(&updated, "updated", &today);
    fs::write(&path, updated).map_err(|e| format!("Could not save {spec_path}: {e}"))
}

/// A composed agent handoff: the prompt text and the path it was written to.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandoffResult {
    pub path: String,
    pub content: String,
}

/// Compose an agent-agnostic handoff prompt from a spec's three files. Pure +
/// tested; empty plan/tasks become "(none)".
fn compose_handoff(id: &str, title: &str, dir_rel_path: &str, spec: &str, plan: &str, tasks: &str) -> String {
    let section = |body: &str| -> String {
        let t = body.trim();
        if t.is_empty() { "(none)".to_string() } else { t.to_string() }
    };
    format!(
        "# Agent handoff — {id}: {title}\n\
         \n\
         You are an AI coding agent working in this repository. Implement the\n\
         specification below. Stay within scope, keep changes minimal and reviewable,\n\
         and tick off items in tasks.md (`- [ ]` -> `- [x]`) as you complete them.\n\
         When you commit, start the message with the spec id and task id(s), e.g.\n\
         `{id} T003: ...`, so Branchnote can trace each commit back to this spec.\n\
         \n\
         Spec folder: {dir_rel_path}\n\
         \n\
         ## Specification (spec.md)\n\
         \n\
         {spec}\n\
         \n\
         ## Plan (plan.md)\n\
         \n\
         {plan}\n\
         \n\
         ## Tasks (tasks.md)\n\
         \n\
         {tasks}\n",
        spec = section(spec),
        plan = section(plan),
        tasks = section(tasks),
    )
}

/// Build a context package for an external coding agent: read the spec's
/// `spec.md`/`plan.md`/`tasks.md`, compose a prompt, write it to `handoff.md` in
/// the spec folder, and return the path + content (the frontend also copies it to
/// the clipboard and opens a terminal — the "launchpad"). Rich handoff: Branchnote
/// never calls a model itself.
#[tauri::command]
pub fn write_handoff(root: String, dir_rel_path: String) -> Result<HandoffResult, String> {
    let dir = PathBuf::from(&root).join(&dir_rel_path);
    if !dir.is_dir() {
        return Err(format!("Not a folder: {}", dir.to_string_lossy()));
    }
    let spec = fs::read_to_string(dir.join("spec.md"))
        .map_err(|e| format!("Could not read spec.md: {e}"))?;
    let fm = parse_frontmatter(&spec);
    let dir_name = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let id = fm.get("id").cloned().unwrap_or_else(|| dir_name.clone());
    let title = fm
        .get("title")
        .filter(|t| !t.is_empty())
        .cloned()
        .unwrap_or_else(|| dir_name.clone());
    let plan = fs::read_to_string(dir.join("plan.md")).unwrap_or_default();
    let tasks = fs::read_to_string(dir.join("tasks.md")).unwrap_or_default();

    let content = compose_handoff(&id, &title, &dir_rel_path, &spec, &plan, &tasks);
    let path = dir.join("handoff.md");
    fs::write(&path, &content).map_err(|e| format!("Could not write handoff.md: {e}"))?;
    Ok(HandoffResult {
        path: path.to_string_lossy().to_string(),
        content,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_frontmatter_basic() {
        let md = "---\nid: SPEC-001\ntitle: User Auth\nstatus: draft\n---\n\n# Body\n";
        let fm = parse_frontmatter(md);
        assert_eq!(fm.get("id").unwrap(), "SPEC-001");
        assert_eq!(fm.get("title").unwrap(), "User Auth");
        assert_eq!(fm.get("status").unwrap(), "draft");
    }

    #[test]
    fn parse_frontmatter_missing_block_is_empty() {
        assert!(parse_frontmatter("# Just a heading\nno frontmatter\n").is_empty());
    }

    #[test]
    fn parse_frontmatter_value_can_contain_colon() {
        let fm = parse_frontmatter("---\ntitle: Foo: Bar\n---\n");
        assert_eq!(fm.get("title").unwrap(), "Foo: Bar");
    }

    #[test]
    fn task_progress_counts_done_and_total() {
        let md = "# Tasks\n- [x] one\n- [X] two\n- [ ] three\nplain line\n* [ ] four\n";
        assert_eq!(task_progress(md), SpecProgress { done: 2, total: 4 });
    }

    #[test]
    fn task_progress_ignores_non_tasks() {
        assert_eq!(
            task_progress("- bullet\n1. number\n[ ] no dash\n"),
            SpecProgress { done: 0, total: 0 }
        );
    }

    #[test]
    fn next_spec_number_empty_is_one() {
        let dir = std::env::temp_dir().join(format!("bn-specs-empty-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        assert_eq!(next_spec_number(&dir), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn next_spec_number_is_max_plus_one() {
        let dir = std::env::temp_dir().join(format!("bn-specs-max-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("SPEC-001-alpha")).unwrap();
        fs::create_dir_all(dir.join("SPEC-003-gamma")).unwrap();
        fs::create_dir_all(dir.join("not-a-spec")).unwrap();
        assert_eq!(next_spec_number(&dir), 4);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn slugify_basic() {
        assert_eq!(slugify("User Authentication"), "user-authentication");
        assert_eq!(slugify("  Add PDF export!! "), "add-pdf-export");
        assert_eq!(slugify("C++  &  Rust"), "c-rust");
    }

    #[test]
    fn set_frontmatter_field_replaces_existing() {
        let md = "---\nid: SPEC-001\nstatus: draft\n---\n\n# Body\n";
        let out = set_frontmatter_field(md, "status", "done");
        assert!(out.contains("status: done"));
        assert!(!out.contains("status: draft"));
        assert!(out.contains("# Body"));
    }

    #[test]
    fn compose_handoff_includes_sections() {
        let out = compose_handoff(
            "SPEC-001",
            "User Auth",
            "specs/SPEC-001-user-auth",
            "spec body here",
            "plan body here",
            "- [ ] T001 do it",
        );
        assert!(out.contains("SPEC-001"));
        assert!(out.contains("User Auth"));
        assert!(out.contains("specs/SPEC-001-user-auth"));
        assert!(out.contains("spec body here"));
        assert!(out.contains("plan body here"));
        assert!(out.contains("- [ ] T001 do it"));
    }

    #[test]
    fn compose_handoff_marks_missing_sections() {
        let out = compose_handoff("SPEC-002", "X", "specs/x", "only spec", "", "   ");
        assert!(out.contains("(none)"));
    }

    #[test]
    fn set_frontmatter_field_inserts_when_missing() {
        let md = "---\nid: SPEC-001\n---\n\n# Body\n";
        let out = set_frontmatter_field(md, "updated", "2026-05-31");
        assert!(out.contains("updated: 2026-05-31"));
        assert_eq!(parse_frontmatter(&out).get("id").unwrap(), "SPEC-001");
    }
}
