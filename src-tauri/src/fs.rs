//! Filesystem operations for the workspace.
//!
//! All paths cross the IPC boundary as strings. Commands return
//! `Result<_, String>` so failures surface as rejected promises on the
//! frontend (see `systemPatterns.md` — surface errors to the user).
//!
//! Discovery emits both markdown files and directories so the frontend can
//! render a folder tree (and show empty / just-created folders).

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    /// Absolute path on disk.
    pub path: String,
    /// File or folder name, e.g. "ideas.md" or "notes".
    pub name: String,
    /// Path relative to the workspace root, forward-slashed.
    pub rel_path: String,
    /// True for directories.
    pub is_dir: bool,
    /// Creation time, seconds since the Unix epoch (None if unavailable).
    pub created: Option<u64>,
    /// Last-modified time, seconds since the Unix epoch (None if unavailable).
    pub modified: Option<u64>,
}

/// A `SystemTime` as whole seconds since the Unix epoch, or None on error.
fn secs(t: std::io::Result<std::time::SystemTime>) -> Option<u64> {
    t.ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs())
}

fn is_markdown(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref(),
        Some("md") | Some("markdown")
    )
}

/// Skip hidden dirs and common heavy folders so discovery stays fast.
fn skip_dir(name: &str) -> bool {
    name.starts_with('.') || matches!(name, "node_modules" | "target")
}

fn rel_of(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn walk(dir: &Path, root: &Path, out: &mut Vec<FileEntry>) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        let name = entry.file_name().to_string_lossy().to_string();
        let meta = entry.metadata().ok();
        let created = meta.as_ref().and_then(|m| secs(m.created()));
        let modified = meta.as_ref().and_then(|m| secs(m.modified()));

        if file_type.is_dir() {
            if skip_dir(&name) {
                continue;
            }
            out.push(FileEntry {
                path: path.to_string_lossy().to_string(),
                name,
                rel_path: rel_of(&path, root),
                is_dir: true,
                created,
                modified,
            });
            walk(&path, root, out)?;
        } else if file_type.is_file() && is_markdown(&path) {
            out.push(FileEntry {
                path: path.to_string_lossy().to_string(),
                name,
                rel_path: rel_of(&path, root),
                is_dir: false,
                created,
                modified,
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_entries(root: String) -> Result<Vec<FileEntry>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a folder: {root}"));
    }
    let mut out = Vec::new();
    walk(&root_path, &root_path, &mut out).map_err(|e| e.to_string())?;
    out.sort_by(|a, b| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase()));
    Ok(out)
}

/// Resolve (and create if missing) the default vault at `Documents/Branchnote`.
#[tauri::command]
pub fn default_vault(app: tauri::AppHandle) -> Result<String, String> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| format!("Could not resolve Documents folder: {e}"))?;
    let vault = docs.join("Branchnote");
    fs::create_dir_all(&vault).map_err(|e| e.to_string())?;
    Ok(vault.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Could not read {path}: {e}"))
}

#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Could not save {path}: {e}"))
}

/// Reject names that could escape the target directory.
fn validate_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Name cannot be empty".into());
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err("Name cannot contain path separators or '..'".into());
    }
    Ok(())
}

/// Append `.md` unless the name already ends in a markdown extension.
fn ensure_md(name: &str) -> String {
    if is_markdown(Path::new(name)) {
        name.to_string()
    } else {
        format!("{name}.md")
    }
}

#[tauri::command]
pub fn create_file(dir: String, name: String) -> Result<String, String> {
    validate_name(&name)?;
    let file_name = ensure_md(name.trim());
    let target = PathBuf::from(&dir).join(&file_name);
    if target.exists() {
        return Err(format!("{file_name} already exists"));
    }
    fs::write(&target, "").map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

/// Create a new empty note with a default name (`Untitled.md`, `Untitled 1.md`,
/// …) in `dir`, so a note can be added without naming it first. Returns the
/// absolute path. The user renames it via the editor title (see `rename_entry`).
#[tauri::command]
pub fn create_untitled(dir: String) -> Result<String, String> {
    let dir_path = PathBuf::from(&dir);
    for i in 0..1000 {
        let name = if i == 0 {
            "Untitled.md".to_string()
        } else {
            format!("Untitled {i}.md")
        };
        let target = dir_path.join(&name);
        if !target.exists() {
            fs::write(&target, "").map_err(|e| e.to_string())?;
            return Ok(target.to_string_lossy().to_string());
        }
    }
    Err("Could not find a free Untitled name".into())
}

#[tauri::command]
pub fn create_folder(dir: String, name: String) -> Result<String, String> {
    validate_name(&name)?;
    let target = PathBuf::from(&dir).join(name.trim());
    if target.exists() {
        return Err(format!("{} already exists", name.trim()));
    }
    fs::create_dir(&target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

/// Rename a file or folder in place. Files keep a markdown extension; folders
/// are renamed as given.
#[tauri::command]
pub fn rename_entry(path: String, new_name: String) -> Result<String, String> {
    validate_name(&new_name)?;
    let src = PathBuf::from(&path);
    let is_dir = src.is_dir();
    let new_name = if is_dir {
        new_name.trim().to_string()
    } else {
        ensure_md(new_name.trim())
    };
    let parent = src.parent().ok_or("Entry has no parent directory")?;
    let target = parent.join(&new_name);
    if target.exists() && target != src {
        return Err(format!("{new_name} already exists"));
    }
    fs::rename(&src, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_entry(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let result = if p.is_dir() {
        fs::remove_dir_all(&p)
    } else {
        fs::remove_file(&p)
    };
    result.map_err(|e| format!("Could not delete {path}: {e}"))
}

/// Move a file or folder into `dest_dir`. Rejects overwrites and moving a
/// folder into itself or one of its descendants.
#[tauri::command]
pub fn move_entry(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = PathBuf::from(&src);
    let dest = PathBuf::from(&dest_dir);
    if !dest.is_dir() {
        return Err(format!("Not a folder: {dest_dir}"));
    }

    // Prevent moving a folder into itself or a descendant.
    let src_canon = src_path.canonicalize().map_err(|e| e.to_string())?;
    let dest_canon = dest.canonicalize().map_err(|e| e.to_string())?;
    if dest_canon == src_canon || dest_canon.starts_with(&src_canon) {
        return Err("Cannot move a folder into itself".into());
    }

    let name = src_path
        .file_name()
        .ok_or("Source has no file name")?
        .to_owned();
    let target = dest.join(&name);
    if target.exists() {
        return Err(format!("{} already exists in the target folder", name.to_string_lossy()));
    }
    // No-op if already in dest.
    if target == src_path {
        return Ok(src);
    }
    fs::rename(&src_path, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}
