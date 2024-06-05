// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{read, copy};
use std::path::Path;
use std::collections::HashMap;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Your name has length {}!", name, name.len())
}

#[tauri::command]
async fn load_file_content(path: String) -> Result<Vec<u8>, String> {
    let result = read(path);

    match result {
        Err(e) => Err(e.to_string()),
        Ok(content) => Ok(content)
    }
}

#[derive(serde::Serialize)]
struct SaveResult {
    successfully_saved_files: Vec<String>,
    errors: HashMap<String, String>,
}

#[tauri::command]
async fn save_files(paths: Vec<String>, target_directory: String) -> SaveResult {
    let mut result = SaveResult {
        successfully_saved_files: Vec::new(),
        errors: HashMap::new(),
    };
    let target_directory = Path::new(&target_directory);

    for path in paths {
        let path = Path::new(&path);
        let file_name = match path.file_name() {
            None => {
                result.errors.insert(path.to_str().unwrap().to_string(), "Datei scheint keinen Namen zu haben".to_string());
                continue;
            },
            Some(name) => name,
        };
        let destination_path = target_directory.join(file_name);
        if destination_path.exists() {
            result.errors.insert(path.to_str().unwrap().to_string(), "Die Datei existiert bereits".to_string());
            continue;
        }
        match copy(path, destination_path) {
            Err(err) => {
                result.errors.insert(path.to_str().unwrap().to_string(), err.to_string());
            },
            Ok(_) => {
                result.successfully_saved_files.push(path.to_str().unwrap().to_string());
            },
        }
    }

    return result;
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
              let window = app.get_window("main").unwrap();
              window.open_devtools();
            }
            Ok(())
          })
        .invoke_handler(tauri::generate_handler![greet, load_file_content, save_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
