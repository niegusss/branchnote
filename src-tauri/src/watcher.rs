//! Filesystem watching. Emits a `workspace-changed` event (no payload) to the
//! frontend on any debounced change under the open workspace root; the frontend
//! reacts by re-listing files. Git stays visible/explicit — this only mirrors
//! on-disk reality into the tree.

use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_full::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{
    new_debouncer, DebounceEventResult, Debouncer, RecommendedCache,
};
use tauri::{AppHandle, Emitter, State};

type ManagedDebouncer = Debouncer<RecommendedWatcher, RecommendedCache>;

/// Holds the active watcher. Replacing it drops (and stops) the previous one.
#[derive(Default)]
pub struct WatcherState(pub Mutex<Option<ManagedDebouncer>>);

#[tauri::command]
pub fn watch_folder(
    root: String,
    app: AppHandle,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    let app_for_events = app.clone();
    let mut debouncer = new_debouncer(
        Duration::from_millis(400),
        None,
        move |result: DebounceEventResult| {
            if let Ok(events) = result {
                if !events.is_empty() {
                    let _ = app_for_events.emit("workspace-changed", ());
                }
            }
        },
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    // Swap in the new watcher; the old one (if any) is dropped here.
    *state.0.lock().map_err(|e| e.to_string())? = Some(debouncer);
    Ok(())
}
