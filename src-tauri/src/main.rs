// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Emitter, Manager};

mod file_operations;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Your name has length {}!", name, name.len())
}

struct OpenWithFiles(Mutex<Vec<String>>);

// Returns files delivered via macOS "Open With" before the frontend listener was ready,
// then clears the buffer so they aren't returned twice.
#[tauri::command]
fn get_open_with_files(state: tauri::State<OpenWithFiles>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}

fn main() {
    tauri::Builder::default()
        .manage(OpenWithFiles(Mutex::new(vec![])))
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            app.get_webview_window("main").unwrap().open_devtools();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_open_with_files,
            file_operations::save_files,
            file_operations::save_delete_files
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // macOS "Open With" fires RunEvent::Opened instead of passing CLI args.
            // We emit the event for the already-running case, and buffer in state
            // for the fresh-launch case (event may arrive before React mounts).
            match event {
                #[cfg(any(target_os = "macos", target_os = "ios"))]
                tauri::RunEvent::Opened { urls } => {
                    let paths: Vec<String> = urls
                        .iter()
                        .filter(|url| url.scheme() == "file")
                        .filter_map(|url| url.to_file_path().ok())
                        .filter_map(|p| p.to_str().map(String::from))
                        .collect();
                    if !paths.is_empty() {
                        app_handle.state::<OpenWithFiles>().0.lock().unwrap().extend(paths);
                    }
                }
                _ => {}
            }
        });
}
