//! Git operations backed by libgit2 via the `git2` crate.
//!
//! We prefer `git2`/libgit2 over shelling out to the git CLI (see `brief.md`
//! B2 / `techContext.md`). Git is treated as a *visible, explicit* layer.
//! Read path: detect / status / worktree (staged + unstaged) / log. Write path
//! (increment 2): stage / unstage (per-path and all) + commit of the staged set.
//! Pull / push stay for a later increment.
//!
//! Every command returns `Result<_, String>` so failures surface as rejected
//! promises on the frontend (see `systemPatterns.md` — surface errors to the
//! user). Structs are camelCased to mirror the TypeScript types in `types.ts`.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

use git2::{
    build::CheckoutBuilder, Cred, CredentialType, Direction, FetchOptions, IndexAddOption,
    ObjectType, PushOptions, RemoteCallbacks, Repository, Status, StatusOptions,
};
use serde::Serialize;

/// Working-tree summary for the status bar. Mirrors TS `GitStatus`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    /// Current branch shorthand (e.g. "main"). Falls back for an unborn HEAD.
    pub branch: String,
    /// Number of files with uncommitted changes (staged, unstaged, untracked).
    pub changed_files: u32,
    /// True when the working tree has no changes.
    pub clean: bool,
    /// Commits ahead of `origin/<branch>` (to push); None if no tracking ref.
    pub ahead: Option<u32>,
    /// Commits behind `origin/<branch>` (to pull); None if no tracking ref.
    pub behind: Option<u32>,
}

/// One changed path for the Git panel. Mirrors TS `GitFileStatus`.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    /// Path relative to the repo root, forward-slashed.
    pub rel_path: String,
    /// Coarse change kind: "new" | "modified" | "deleted" | "renamed" |
    /// "typechange" | "conflicted".
    pub status: String,
}

/// The working tree split into staged (index vs HEAD) and unstaged (workdir vs
/// index) changes. A file may appear in both. Mirrors TS `WorkingTree`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkingTree {
    pub staged: Vec<GitFileStatus>,
    pub unstaged: Vec<GitFileStatus>,
}

/// One commit for the Git panel's "History" list. Mirrors TS `CommitInfo`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    /// Full commit hash.
    pub id: String,
    /// First line of the commit message.
    pub summary: String,
    /// Author name.
    pub author: String,
    /// Author time, seconds since the Unix epoch.
    pub time: i64,
}

/// A commit that references a spec (for the Traceability view). Mirrors TS `SpecCommit`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpecCommit {
    /// Full commit hash.
    pub id: String,
    /// Abbreviated hash (7 chars) for display.
    pub short_id: String,
    pub summary: String,
    pub author: String,
    pub time: i64,
    /// Spec id referenced by the message, normalized e.g. "SPEC-001".
    pub spec_id: String,
    /// Task ids referenced, normalized e.g. ["T001", "T003"].
    pub tasks: Vec<String>,
}

/// Open the repository whose working directory is exactly `path`.
///
/// We use `open` (not `discover`) on purpose: the vault root *is* the repo root,
/// so a vault nested inside an unrelated parent repo is reported as "no repo"
/// rather than silently adopting the parent. Explicitness over magic.
fn open_repo(path: &str) -> Result<Repository, String> {
    Repository::open(path).map_err(|e| e.to_string())
}

/// Resolve the current branch name, tolerating an unborn HEAD (fresh `init`
/// with no commits yet) by reading the symbolic HEAD target.
fn current_branch(repo: &Repository) -> String {
    if let Ok(head) = repo.head() {
        if let Some(name) = head.shorthand() {
            return name.to_string();
        }
    }
    if let Ok(reference) = repo.find_reference("HEAD") {
        if let Some(target) = reference.symbolic_target() {
            return target.rsplit('/').next().unwrap_or("main").to_string();
        }
    }
    "main".to_string()
}

/// Coarse label for the *staged* side (index vs HEAD), or None if unstaged-clean.
fn index_label(s: Status) -> Option<&'static str> {
    if s.is_index_new() {
        Some("new")
    } else if s.is_index_modified() {
        Some("modified")
    } else if s.is_index_deleted() {
        Some("deleted")
    } else if s.is_index_renamed() {
        Some("renamed")
    } else if s.is_index_typechange() {
        Some("typechange")
    } else {
        None
    }
}

/// Coarse label for the *unstaged* side (workdir vs index), or None if clean.
fn wt_label(s: Status) -> Option<&'static str> {
    if s.is_conflicted() {
        Some("conflicted")
    } else if s.is_wt_new() {
        Some("new")
    } else if s.is_wt_modified() {
        Some("modified")
    } else if s.is_wt_deleted() {
        Some("deleted")
    } else if s.is_wt_renamed() {
        Some("renamed")
    } else if s.is_wt_typechange() {
        Some("typechange")
    } else {
        None
    }
}

/// True if any index (staged) bit is set.
fn has_staged_change(s: Status) -> bool {
    index_label(s).is_some()
}

fn status_options() -> StatusOptions {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);
    opts
}

/// True if `path` is the working directory of a git repository.
#[tauri::command]
pub fn git_is_repo(path: String) -> Result<bool, String> {
    Ok(Repository::open(&path).is_ok())
}

/// Initialise a new git repository at `path`.
#[tauri::command]
pub fn git_init(path: String) -> Result<(), String> {
    Repository::init(&path).map(|_| ()).map_err(|e| e.to_string())
}

/// Branch + change-count summary for the status bar.
#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatus, String> {
    let repo = open_repo(&path)?;
    let branch = current_branch(&repo);
    let mut opts = status_options();
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;
    let changed = statuses
        .iter()
        .filter(|e| {
            let s = e.status();
            s != Status::CURRENT && !s.is_ignored()
        })
        .count() as u32;
    let (ahead, behind) = ahead_behind(&repo, &branch);
    Ok(GitStatus {
        branch,
        changed_files: changed,
        clean: changed == 0,
        ahead,
        behind,
    })
}

/// Commits ahead/behind `origin/<branch>` using the local remote-tracking ref
/// (written on push, refreshed by pull's fetch). None when HEAD is unborn or no
/// tracking ref exists yet.
fn ahead_behind(repo: &Repository, branch: &str) -> (Option<u32>, Option<u32>) {
    let result = (|| {
        let local = repo.head().ok()?.target()?;
        let upstream = repo
            .find_reference(&format!("refs/remotes/origin/{branch}"))
            .ok()?
            .target()?;
        repo.graph_ahead_behind(local, upstream).ok()
    })();
    match result {
        Some((a, b)) => (Some(a as u32), Some(b as u32)),
        None => (None, None),
    }
}

/// The working tree split into staged + unstaged changes for the Git panel.
#[tauri::command]
pub fn git_worktree(path: String) -> Result<WorkingTree, String> {
    let repo = open_repo(&path)?;
    let mut opts = status_options();
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    for entry in statuses.iter() {
        let s = entry.status();
        if s == Status::CURRENT || s.is_ignored() {
            continue;
        }
        let rel = entry.path().unwrap_or_default().replace('\\', "/");
        if let Some(label) = index_label(s) {
            staged.push(GitFileStatus {
                rel_path: rel.clone(),
                status: label.to_string(),
            });
        }
        if let Some(label) = wt_label(s) {
            unstaged.push(GitFileStatus {
                rel_path: rel,
                status: label.to_string(),
            });
        }
    }

    let by_path =
        |a: &GitFileStatus, b: &GitFileStatus| a.rel_path.to_lowercase().cmp(&b.rel_path.to_lowercase());
    staged.sort_by(by_path);
    unstaged.sort_by(by_path);
    Ok(WorkingTree { staged, unstaged })
}

/// Most recent commits, newest first, up to `limit`. Empty for an unborn HEAD.
#[tauri::command]
pub fn git_log(path: String, limit: u32) -> Result<Vec<CommitInfo>, String> {
    let repo = open_repo(&path)?;
    if repo.head().is_err() {
        return Ok(Vec::new()); // no commits yet
    }
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for oid in revwalk.take(limit as usize) {
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        out.push(CommitInfo {
            id: oid.to_string(),
            summary: commit.summary().unwrap_or_default().to_string(),
            author: commit.author().name().unwrap_or_default().to_string(),
            time: commit.time().seconds(),
        });
    }
    Ok(out)
}

/// Read ASCII digits from `chars` at `start`; returns (number, end_index).
fn parse_digits(chars: &[char], start: usize) -> Option<(u64, usize)> {
    let mut i = start;
    let mut s = String::new();
    while i < chars.len() && chars[i].is_ascii_digit() {
        s.push(chars[i]);
        i += 1;
    }
    s.parse::<u64>().ok().map(|n| (n, i))
}

/// Scan a commit message for the first `SPEC-<n>` reference and all `T<n>` task
/// tokens (at word boundaries), normalized to zero-padded ids (`SPEC-001`,
/// `T003`). Pure — drives the Traceability view. Tokens inside words are ignored.
fn extract_refs(message: &str) -> (Option<String>, Vec<String>) {
    let chars: Vec<char> = message.chars().collect();
    let lower: Vec<char> = message.to_ascii_lowercase().chars().collect();
    let n = chars.len();
    let is_word = |c: char| c.is_ascii_alphanumeric() || c == '_';

    let mut spec: Option<String> = None;
    let mut tasks: Vec<String> = Vec::new();

    let mut i = 0;
    while i < n {
        let boundary = i == 0 || !is_word(chars[i - 1]);
        // SPEC-<digits> (first one wins)
        if spec.is_none()
            && boundary
            && i + 5 <= n
            && lower[i] == 's'
            && lower[i + 1] == 'p'
            && lower[i + 2] == 'e'
            && lower[i + 3] == 'c'
            && chars[i + 4] == '-'
        {
            if let Some((num, _)) = parse_digits(&chars, i + 5) {
                spec = Some(format!("SPEC-{num:03}"));
            }
        }
        // T<digits> at a word boundary, ending at a boundary
        if boundary && (chars[i] == 'T' || chars[i] == 't') {
            if let Some((num, end)) = parse_digits(&chars, i + 1) {
                if end >= n || !is_word(chars[end]) {
                    let id = format!("T{num:03}");
                    if !tasks.contains(&id) {
                        tasks.push(id);
                    }
                }
            }
        }
        i += 1;
    }
    (spec, tasks)
}

/// Commits that reference a spec in their message, newest first, up to `limit`.
/// Used by the Traceability view to map spec → task → commit.
#[tauri::command]
pub fn git_spec_commits(path: String, limit: u32) -> Result<Vec<SpecCommit>, String> {
    let repo = open_repo(&path)?;
    if repo.head().is_err() {
        return Ok(Vec::new());
    }
    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk.push_head().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for oid in revwalk.take(limit as usize) {
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
        let (spec, tasks) = extract_refs(commit.message().unwrap_or_default());
        if let Some(spec_id) = spec {
            let id = oid.to_string();
            let short_id = id.chars().take(7).collect::<String>();
            out.push(SpecCommit {
                id,
                short_id,
                summary: commit.summary().unwrap_or_default().to_string(),
                author: commit.author().name().unwrap_or_default().to_string(),
                time: commit.time().seconds(),
                spec_id,
                tasks,
            });
        }
    }
    Ok(out)
}

/// Stage a single path (handles add / modify / delete via `add_all`).
#[tauri::command]
pub fn git_stage(path: String, rel_path: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all([rel_path.as_str()].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

/// Unstage a single path: reset the index entry to HEAD (or drop it if unborn).
#[tauri::command]
pub fn git_unstage(path: String, rel_path: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    match repo.head() {
        Ok(head) => {
            let obj = head.peel(ObjectType::Commit).map_err(|e| e.to_string())?;
            repo.reset_default(Some(&obj), [rel_path.as_str()].iter())
                .map_err(|e| e.to_string())?;
        }
        Err(_) => {
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index
                .remove_path(Path::new(&rel_path))
                .map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Stage every change (adds / mods / deletions), mirroring `git add -A`.
#[tauri::command]
pub fn git_stage_all(path: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

/// Unstage everything: reset the whole index to HEAD (or clear it if unborn).
#[tauri::command]
pub fn git_unstage_all(path: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    match repo.head() {
        Ok(head) => {
            let obj = head.peel(ObjectType::Commit).map_err(|e| e.to_string())?;
            repo.reset_default(Some(&obj), ["*"].iter())
                .map_err(|e| e.to_string())?;
        }
        Err(_) => {
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index
                .remove_all(["*"].iter(), None)
                .map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Commit the currently staged set with `message`.
#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<(), String> {
    let msg = message.trim();
    if msg.is_empty() {
        return Err("Commit message cannot be empty".into());
    }
    let repo = open_repo(&path)?;

    // Require something staged.
    let mut opts = status_options();
    let has_staged = repo
        .statuses(Some(&mut opts))
        .map_err(|e| e.to_string())?
        .iter()
        .any(|e| has_staged_change(e.status()));
    if !has_staged {
        return Err("Nothing staged to commit".into());
    }

    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree = repo
        .find_tree(index.write_tree().map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    let sig = repo.signature().map_err(|_| {
        "Set your git identity first (git config user.name / user.email)".to_string()
    })?;

    let parent = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();

    repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Remote URL + identity (git config — git-native, not secret)
// ---------------------------------------------------------------------------

/// Git identity. Mirrors TS `Identity`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub name: String,
    pub email: String,
}

/// The `origin` remote URL, or None if no origin is configured.
#[tauri::command]
pub fn git_get_remote(path: String) -> Result<Option<String>, String> {
    let repo = open_repo(&path)?;
    let url = repo
        .find_remote("origin")
        .ok()
        .and_then(|r| r.url().map(|u| u.to_string()));
    Ok(url)
}

/// Create or update the `origin` remote URL.
#[tauri::command]
pub fn git_set_remote(path: String, url: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let url = url.trim();
    if url.is_empty() {
        return Err("Remote URL cannot be empty".into());
    }
    if repo.find_remote("origin").is_ok() {
        repo.remote_set_url("origin", url).map_err(|e| e.to_string())?;
    } else {
        repo.remote("origin", url).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Read `user.name` / `user.email` from the repo config (merged with global).
#[tauri::command]
pub fn git_get_identity(path: String) -> Result<Identity, String> {
    let repo = open_repo(&path)?;
    let cfg = repo.config().map_err(|e| e.to_string())?;
    Ok(Identity {
        name: cfg.get_string("user.name").unwrap_or_default(),
        email: cfg.get_string("user.email").unwrap_or_default(),
    })
}

/// Write `user.name` / `user.email` to the repo-local config.
#[tauri::command]
pub fn git_set_identity(path: String, name: String, email: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let mut cfg = repo.config().map_err(|e| e.to_string())?;
    cfg.set_str("user.name", name.trim()).map_err(|e| e.to_string())?;
    cfg.set_str("user.email", email.trim()).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// HTTPS token (OS keychain — the only secret)
// ---------------------------------------------------------------------------

fn https_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("branchnote", "https-auth").map_err(|e| e.to_string())
}

/// Persist the HTTPS `{username, token}` credential in the OS keychain. Shared
/// by the manual-PAT command and the GitHub device flow so both store identically.
fn write_https_auth(username: &str, token: &str) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Token cannot be empty".into());
    }
    let payload = serde_json::json!({ "username": username.trim(), "token": token }).to_string();
    https_entry()?.set_password(&payload).map_err(|e| e.to_string())
}

/// Store the HTTPS `{username, token}` credential in the OS keychain.
#[tauri::command]
pub fn git_set_https_auth(username: String, token: String) -> Result<(), String> {
    write_https_auth(&username, &token)
}

/// True if an HTTPS token is stored.
#[tauri::command]
pub fn git_has_https_auth() -> Result<bool, String> {
    match https_entry()?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Remove the stored HTTPS token (no-op if none).
#[tauri::command]
pub fn git_clear_https_auth() -> Result<(), String> {
    match https_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// The stored HTTPS account name for a "Signed in as …" label, or None.
#[tauri::command]
pub fn git_https_account() -> Result<Option<String>, String> {
    Ok(read_https_auth().map(|(username, _)| username))
}

/// Read the stored HTTPS credential. Username defaults to "git" when blank
/// (GitHub ignores it for PATs). Returns None if nothing is stored.
fn read_https_auth() -> Option<(String, String)> {
    let raw = keyring::Entry::new("branchnote", "https-auth")
        .ok()?
        .get_password()
        .ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let token = v.get("token")?.as_str()?.to_string();
    let username = v
        .get("username")
        .and_then(|x| x.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("git")
        .to_string();
    Some((username, token))
}

// ---------------------------------------------------------------------------
// Pull / push
// ---------------------------------------------------------------------------

fn ssh_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(|h| PathBuf::from(h).join(".ssh"))
}

/// Credentials callback handling whatever the remote requests: HTTPS PAT (from
/// the keychain) or SSH (ssh-agent, then default `~/.ssh` keys). The URL scheme
/// decides which type libgit2 asks for; one closure covers both.
fn auth_callbacks<'a>() -> RemoteCallbacks<'a> {
    let mut cb = RemoteCallbacks::new();
    let ssh_attempts = AtomicUsize::new(0);
    cb.credentials(move |_url, username_from_url, allowed| {
        let user = username_from_url.unwrap_or("git");
        if allowed.contains(CredentialType::USERNAME) {
            return Cred::username(user);
        }
        if allowed.contains(CredentialType::SSH_KEY) {
            return match ssh_attempts.fetch_add(1, Ordering::SeqCst) {
                0 => Cred::ssh_key_from_agent(user),
                n @ (1 | 2) => {
                    let name = if n == 1 { "id_ed25519" } else { "id_rsa" };
                    let dir = ssh_dir()
                        .ok_or_else(|| git2::Error::from_str("cannot locate ~/.ssh"))?;
                    let priv_key = dir.join(name);
                    if priv_key.exists() {
                        Cred::ssh_key(user, Some(&dir.join(format!("{name}.pub"))), &priv_key, None)
                    } else {
                        Err(git2::Error::from_str("no usable SSH key (agent + default keys failed)"))
                    }
                }
                _ => Err(git2::Error::from_str("SSH authentication failed")),
            };
        }
        if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) {
            return match read_https_auth() {
                Some((u, t)) => Cred::userpass_plaintext(&u, &t),
                None => Err(git2::Error::from_str("Set a personal access token in Settings")),
            };
        }
        Err(git2::Error::from_str("no supported authentication method"))
    });
    cb
}

/// Push the current branch to `origin`.
#[tauri::command]
pub fn git_push(path: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    if repo.head().is_err() {
        return Err("Nothing committed to push yet".into());
    }
    let branch = current_branch(&repo);
    let mut remote = repo.find_remote("origin").map_err(|_| {
        "No 'origin' remote configured — set a remote URL in Settings".to_string()
    })?;
    let mut po = PushOptions::new();
    po.remote_callbacks(auth_callbacks());
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    remote
        .push(&[refspec.as_str()], Some(&mut po))
        .map_err(|e| e.to_string())?;

    // Make sync "just work" for non-power-users: record upstream tracking so
    // ahead/behind compute immediately (no manual fetch). Best-effort — the push
    // already succeeded, so failures here must not fail the command.
    if let Some(oid) = repo.head().ok().and_then(|h| h.target()) {
        let _ = repo.reference(
            &format!("refs/remotes/origin/{branch}"),
            oid,
            true,
            "push: update tracking",
        );
        if let Ok(mut cfg) = repo.config() {
            let _ = cfg.set_str(&format!("branch.{branch}.remote"), "origin");
            let _ = cfg.set_str(
                &format!("branch.{branch}.merge"),
                &format!("refs/heads/{branch}"),
            );
        }
    }
    Ok(())
}

/// Fetch `origin` and fast-forward the current branch. Returns "up-to-date",
/// "fast-forward", or "diverged" (diverged is surfaced, never auto-merged).
#[tauri::command]
pub fn git_pull(path: String) -> Result<String, String> {
    let repo = open_repo(&path)?;
    let branch = current_branch(&repo);
    let mut remote = repo.find_remote("origin").map_err(|_| {
        "No 'origin' remote configured — set a remote URL in Settings".to_string()
    })?;

    let mut fo = FetchOptions::new();
    fo.remote_callbacks(auth_callbacks());
    remote
        .fetch(&[branch.as_str()], Some(&mut fo), None)
        .map_err(|e| e.to_string())?;

    let fetch_head = repo.find_reference("FETCH_HEAD").map_err(|e| e.to_string())?;
    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| e.to_string())?;
    let (analysis, _) = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| e.to_string())?;

    if analysis.is_up_to_date() {
        return Ok("up-to-date".into());
    }
    if analysis.is_fast_forward() {
        let refname = format!("refs/heads/{branch}");
        match repo.find_reference(&refname) {
            Ok(mut r) => {
                r.set_target(fetch_commit.id(), "pull: fast-forward")
                    .map_err(|e| e.to_string())?;
            }
            Err(_) => {
                // Unborn branch: create it pointing at the fetched commit.
                repo.reference(&refname, fetch_commit.id(), true, "pull: create")
                    .map_err(|e| e.to_string())?;
            }
        }
        repo.set_head(&refname).map_err(|e| e.to_string())?;
        repo.checkout_head(Some(CheckoutBuilder::new().force()))
            .map_err(|e| e.to_string())?;
        return Ok("fast-forward".into());
    }
    Ok("diverged".into())
}

// ---------------------------------------------------------------------------
// Connection test + GitHub sign-in (OAuth device flow)
// ---------------------------------------------------------------------------

/// Authenticated handshake with `origin`. Validates the remote URL *and*
/// credentials for whichever scheme the remote uses (SSH or HTTPS), reusing
/// `auth_callbacks`. The connection auto-disconnects when dropped.
#[tauri::command]
pub fn git_test_remote(path: String) -> Result<(), String> {
    let repo = open_repo(&path)?;
    let mut remote = repo.find_remote("origin").map_err(|_| {
        "No 'origin' remote configured — set a remote URL in Settings".to_string()
    })?;
    remote
        .connect_auth(Direction::Fetch, Some(auth_callbacks()), None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Public OAuth App client id. **Not a secret** — device flow uses no client
/// secret, so it ships embedded (same as the GitHub CLI / VS Code). Register the
/// app at github.com/settings/developers with "Enable Device Flow" checked.
const GITHUB_CLIENT_ID: &str = "Ov23liEM9it0POeD21jO";

/// User-facing device-flow handshake info. Mirrors TS `DeviceCodeInfo`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCodeInfo {
    /// Opaque code the app polls with (not shown to the user).
    pub device_code: String,
    /// Short code the user types at the verification URL.
    pub user_code: String,
    /// Where the user enters the code (github.com/login/device).
    pub verification_uri: String,
    /// Minimum seconds between polls.
    pub interval: u64,
    /// Seconds until the codes expire.
    pub expires_in: u64,
}

/// Begin the GitHub device flow: request a user code + verification URL.
#[tauri::command]
pub fn github_device_start() -> Result<DeviceCodeInfo, String> {
    let resp = ureq::post("https://github.com/login/device/code")
        .set("Accept", "application/json")
        .send_form(&[("client_id", GITHUB_CLIENT_ID), ("scope", "repo")])
        .map_err(|e| format!("Could not reach GitHub: {e}"))?;
    let v: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;
    if let Some(err) = v.get("error").and_then(|x| x.as_str()) {
        let desc = v
            .get("error_description")
            .and_then(|x| x.as_str())
            .unwrap_or(err);
        return Err(format!("GitHub: {desc}"));
    }
    let get = |k: &str| -> Result<String, String> {
        v.get(k)
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| format!("GitHub response missing '{k}'"))
    };
    Ok(DeviceCodeInfo {
        device_code: get("device_code")?,
        user_code: get("user_code")?,
        verification_uri: get("verification_uri")?,
        interval: v.get("interval").and_then(|x| x.as_u64()).unwrap_or(5),
        expires_in: v.get("expires_in").and_then(|x| x.as_u64()).unwrap_or(900),
    })
}

/// Poll once for the device-flow token. Returns "authorized" (token stored in
/// the keychain), "pending", or "slow_down"; errors on denial/expiry/failure.
#[tauri::command]
pub fn github_device_poll(device_code: String) -> Result<String, String> {
    let resp = ureq::post("https://github.com/login/oauth/access_token")
        .set("Accept", "application/json")
        .send_form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", device_code.as_str()),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .map_err(|e| format!("Could not reach GitHub: {e}"))?;
    let v: serde_json::Value = resp.into_json().map_err(|e| e.to_string())?;

    if let Some(token) = v.get("access_token").and_then(|x| x.as_str()) {
        let login = github_login(token).unwrap_or_else(|| "git".to_string());
        write_https_auth(&login, token)?;
        return Ok("authorized".into());
    }
    match v.get("error").and_then(|x| x.as_str()) {
        Some("authorization_pending") => Ok("pending".into()),
        Some("slow_down") => Ok("slow_down".into()),
        Some("expired_token") => Err("The code expired — start sign-in again".into()),
        Some("access_denied") => Err("Sign-in was cancelled on GitHub".into()),
        Some(other) => Err(format!("GitHub sign-in failed: {other}")),
        None => Err("Unexpected response from GitHub".into()),
    }
}

/// Best-effort fetch of the authenticated user's login for the "Signed in as"
/// label. Falls back to "git" at the call site if this fails.
fn github_login(token: &str) -> Option<String> {
    let resp = ureq::get("https://api.github.com/user")
        .set("Authorization", &format!("Bearer {token}"))
        .set("User-Agent", "branchnote")
        .set("Accept", "application/vnd.github+json")
        .call()
        .ok()?;
    let v: serde_json::Value = resp.into_json().ok()?;
    v.get("login").and_then(|x| x.as_str()).map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{IndexAddOption, Repository, Signature};
    use std::fs;
    use std::path::Path;

    /// A fresh temp dir with an initialised repo. Returns the dir guard (keep it
    /// alive for the test's duration) and its path as a String.
    fn temp_repo() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().to_string();
        Repository::init(&path).unwrap();
        (dir, path)
    }

    /// Configure a git identity so `git_commit` (which reads config) works.
    fn set_identity(path: &str) {
        let repo = Repository::open(path).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@example.com").unwrap();
    }

    /// Stage everything and commit, creating HEAD if needed (read-path tests).
    fn commit_all(path: &str, msg: &str) {
        let repo = Repository::open(path).unwrap();
        let mut index = repo.index().unwrap();
        index
            .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
            .unwrap();
        index.write().unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let sig = Signature::now("Test", "test@example.com").unwrap();
        let parent = repo
            .head()
            .ok()
            .and_then(|h| h.target())
            .and_then(|oid| repo.find_commit(oid).ok());
        let parents: Vec<&git2::Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents)
            .unwrap();
    }

    #[test]
    fn detects_repo_vs_plain_dir() {
        let (_d, path) = temp_repo();
        assert!(git_is_repo(path).unwrap());

        let plain = tempfile::tempdir().unwrap();
        assert!(!git_is_repo(plain.path().to_string_lossy().to_string()).unwrap());
    }

    #[test]
    fn init_makes_a_repo() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().to_string();
        assert!(!git_is_repo(path.clone()).unwrap());
        git_init(path.clone()).unwrap();
        assert!(git_is_repo(path).unwrap());
    }

    #[test]
    fn status_counts_untracked_then_clean_after_commit() {
        let (_d, path) = temp_repo();

        // Fresh repo, nothing on disk → clean.
        assert!(git_status(path.clone()).unwrap().clean);

        fs::write(Path::new(&path).join("a.md"), "hi").unwrap();
        let st = git_status(path.clone()).unwrap();
        assert!(!st.clean);
        assert_eq!(st.changed_files, 1);

        let wt = git_worktree(path.clone()).unwrap();
        assert_eq!(wt.unstaged.len(), 1);
        assert_eq!(wt.unstaged[0].rel_path, "a.md");
        assert_eq!(wt.unstaged[0].status, "new");
        assert!(wt.staged.is_empty());

        commit_all(&path, "add a");
        assert!(git_status(path).unwrap().clean);
    }

    #[test]
    fn log_is_empty_until_commit_then_lists_newest_first() {
        let (_d, path) = temp_repo();
        assert!(git_log(path.clone(), 10).unwrap().is_empty());

        fs::write(Path::new(&path).join("a.md"), "one").unwrap();
        commit_all(&path, "first");
        fs::write(Path::new(&path).join("b.md"), "two").unwrap();
        commit_all(&path, "second");

        let log = git_log(path, 10).unwrap();
        assert_eq!(log.len(), 2);
        assert_eq!(log[0].summary, "second");
        assert_eq!(log[1].summary, "first");
        assert_eq!(log[0].author, "Test");
    }

    #[test]
    fn extract_refs_parses_spec_and_tasks() {
        let (spec, tasks) = extract_refs("SPEC-1 T3: add login");
        assert_eq!(spec, Some("SPEC-001".to_string()));
        assert_eq!(tasks, vec!["T003".to_string()]);

        let (spec, tasks) = extract_refs("SPEC-002 implement T001 and T002");
        assert_eq!(spec, Some("SPEC-002".to_string()));
        assert_eq!(tasks, vec!["T001".to_string(), "T002".to_string()]);
    }

    #[test]
    fn extract_refs_ignores_non_refs_and_in_word_tokens() {
        assert_eq!(extract_refs("chore: tidy up"), (None, Vec::new()));
        // 'T' inside words (STATUS, reTest) must not match.
        let (spec, tasks) = extract_refs("STATUS reTest done");
        assert_eq!(spec, None);
        assert!(tasks.is_empty());
    }

    #[test]
    fn git_spec_commits_links_by_message() {
        let (_d, path) = temp_repo();
        fs::write(Path::new(&path).join("a.md"), "1").unwrap();
        commit_all(&path, "SPEC-001 T001: add a");
        fs::write(Path::new(&path).join("b.md"), "2").unwrap();
        commit_all(&path, "chore: unrelated");

        let sc = git_spec_commits(path, 10).unwrap();
        assert_eq!(sc.len(), 1);
        assert_eq!(sc[0].spec_id, "SPEC-001");
        assert_eq!(sc[0].tasks, vec!["T001".to_string()]);
        assert_eq!(sc[0].short_id.len(), 7);
    }

    #[test]
    fn stage_and_unstage_move_between_sections() {
        let (_d, path) = temp_repo();
        fs::write(Path::new(&path).join("a.md"), "hi").unwrap();

        let wt = git_worktree(path.clone()).unwrap();
        assert_eq!(wt.unstaged.len(), 1);
        assert!(wt.staged.is_empty());

        git_stage(path.clone(), "a.md".into()).unwrap();
        let wt = git_worktree(path.clone()).unwrap();
        assert_eq!(wt.staged.len(), 1);
        assert_eq!(wt.staged[0].status, "new");
        assert!(wt.unstaged.is_empty());

        // Unborn-HEAD unstage path.
        git_unstage(path.clone(), "a.md".into()).unwrap();
        let wt = git_worktree(path).unwrap();
        assert!(wt.staged.is_empty());
        assert_eq!(wt.unstaged.len(), 1);
    }

    #[test]
    fn stage_all_then_commit_makes_repo_clean() {
        let (_d, path) = temp_repo();
        set_identity(&path);
        fs::write(Path::new(&path).join("a.md"), "1").unwrap();
        fs::write(Path::new(&path).join("b.md"), "2").unwrap();

        git_stage_all(path.clone()).unwrap();
        git_commit(path.clone(), "init".into()).unwrap();

        assert!(git_status(path.clone()).unwrap().clean);
        let log = git_log(path, 10).unwrap();
        assert_eq!(log.len(), 1);
        assert_eq!(log[0].summary, "init");
    }

    #[test]
    fn commit_requires_staged_and_message() {
        let (_d, path) = temp_repo();
        set_identity(&path);
        fs::write(Path::new(&path).join("a.md"), "1").unwrap();

        // Nothing staged yet.
        assert!(git_commit(path.clone(), "msg".into()).is_err());

        git_stage(path.clone(), "a.md".into()).unwrap();
        // Empty message.
        assert!(git_commit(path.clone(), "   ".into()).is_err());
        // Valid.
        git_commit(path, "ok".into()).unwrap();
    }

    #[test]
    fn commit_includes_only_staged() {
        let (_d, path) = temp_repo();
        set_identity(&path);
        fs::write(Path::new(&path).join("a.md"), "1").unwrap();
        fs::write(Path::new(&path).join("b.md"), "2").unwrap();

        git_stage(path.clone(), "a.md".into()).unwrap();
        git_commit(path.clone(), "only a".into()).unwrap();

        let wt = git_worktree(path.clone()).unwrap();
        assert!(wt.staged.is_empty());
        assert_eq!(wt.unstaged.len(), 1);
        assert_eq!(wt.unstaged[0].rel_path, "b.md");
        assert!(!git_status(path.clone()).unwrap().clean);

        // HEAD now exists: exercise the reset_default unstage path.
        git_stage(path.clone(), "b.md".into()).unwrap();
        assert_eq!(git_worktree(path.clone()).unwrap().staged.len(), 1);
        git_unstage(path.clone(), "b.md".into()).unwrap();
        assert!(git_worktree(path).unwrap().staged.is_empty());
    }

    /// A fresh bare repo to act as a local `origin` (no credentials needed).
    fn init_bare() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().to_string();
        Repository::init_bare(&path).unwrap();
        (dir, path)
    }

    #[test]
    fn remote_round_trip() {
        let (_d, path) = temp_repo();
        assert!(git_get_remote(path.clone()).unwrap().is_none());
        git_set_remote(path.clone(), "https://example.com/x.git".into()).unwrap();
        assert_eq!(
            git_get_remote(path.clone()).unwrap().as_deref(),
            Some("https://example.com/x.git")
        );
        git_set_remote(path.clone(), "https://example.com/y.git".into()).unwrap();
        assert_eq!(
            git_get_remote(path).unwrap().as_deref(),
            Some("https://example.com/y.git")
        );
    }

    #[test]
    fn identity_round_trip_and_flows_into_commit() {
        let (_d, path) = temp_repo();
        git_set_identity(path.clone(), "Ann".into(), "ann@example.com".into()).unwrap();
        let id = git_get_identity(path.clone()).unwrap();
        assert_eq!(id.name, "Ann");
        assert_eq!(id.email, "ann@example.com");

        fs::write(Path::new(&path).join("a.md"), "x").unwrap();
        git_stage(path.clone(), "a.md".into()).unwrap();
        git_commit(path.clone(), "c".into()).unwrap();
        assert_eq!(git_log(path, 10).unwrap()[0].author, "Ann");
    }

    #[test]
    fn push_then_pull_fast_forward_via_local_bare() {
        // Work repo A with one commit, origin = local bare repo.
        let (_a, a) = temp_repo();
        set_identity(&a);
        fs::write(Path::new(&a).join("a.md"), "1").unwrap();
        git_stage(a.clone(), "a.md".into()).unwrap();
        git_commit(a.clone(), "first".into()).unwrap();

        let (_bare, bare) = init_bare();
        git_set_remote(a.clone(), bare.clone()).unwrap(); // local transport → no creds
        git_push(a.clone()).unwrap();

        // Clone the bare repo, add a commit, push it back.
        let cdir = tempfile::tempdir().unwrap();
        let c = cdir.path().to_string_lossy().to_string();
        let repo_c = Repository::clone(&bare, &c).unwrap();
        {
            let mut cfg = repo_c.config().unwrap();
            cfg.set_str("user.name", "C").unwrap();
            cfg.set_str("user.email", "c@example.com").unwrap();
        }
        fs::write(Path::new(&c).join("b.md"), "2").unwrap();
        git_stage(c.clone(), "b.md".into()).unwrap();
        git_commit(c.clone(), "second".into()).unwrap();
        git_push(c).unwrap();

        // Pull into A → fast-forward; the new file appears.
        assert_eq!(git_pull(a.clone()).unwrap(), "fast-forward");
        assert!(Path::new(&a).join("b.md").exists());
        // Nothing new → up to date.
        assert_eq!(git_pull(a).unwrap(), "up-to-date");
    }

    #[test]
    fn push_without_commit_errors() {
        let (_d, path) = temp_repo();
        let (_bare, bare) = init_bare();
        git_set_remote(path.clone(), bare).unwrap();
        assert!(git_push(path).is_err());
    }
}
