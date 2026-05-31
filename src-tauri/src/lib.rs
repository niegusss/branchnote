mod fs;
mod git;
mod specs;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(watcher::WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            fs::default_vault,
            fs::list_entries,
            fs::read_file,
            fs::save_file,
            fs::create_file,
            fs::create_untitled,
            fs::create_folder,
            fs::rename_entry,
            fs::delete_entry,
            fs::move_entry,
            fs::scan_links,
            fs::open_terminal,
            specs::create_spec,
            specs::scan_specs,
            specs::set_status,
            specs::write_handoff,
            git::git_is_repo,
            git::git_init,
            git::git_status,
            git::git_worktree,
            git::git_log,
            git::git_spec_commits,
            git::git_stage,
            git::git_unstage,
            git::git_stage_all,
            git::git_unstage_all,
            git::git_commit,
            git::git_get_remote,
            git::git_set_remote,
            git::git_get_identity,
            git::git_set_identity,
            git::git_set_https_auth,
            git::git_has_https_auth,
            git::git_clear_https_auth,
            git::git_https_account,
            git::git_push,
            git::git_pull,
            git::git_test_remote,
            git::github_device_start,
            git::github_device_poll,
            watcher::watch_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
