mod fs;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(watcher::WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            fs::default_vault,
            fs::list_entries,
            fs::read_file,
            fs::save_file,
            fs::create_file,
            fs::create_folder,
            fs::rename_entry,
            fs::delete_entry,
            fs::move_entry,
            watcher::watch_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
