// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::collections::HashMap;
use std::fs::{copy, rename};
use std::path::Path;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Your name has length {}!", name, name.len())
}

#[derive(serde::Serialize)]
struct SaveResult {
    successfully_saved_files: Vec<String>,
    errors: HashMap<String, String>,
    renamed_files: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum SaveAction {
    COPY,
    MOVE,
}

#[derive(Debug, Deserialize)]
struct UserFile {
    path: String,
    tag: Option<String>,
}

#[tauri::command]
async fn save_files(
    files: Vec<UserFile>,
    target_directory: String,
    save_action: SaveAction,
) -> SaveResult {
    let mut result = SaveResult {
        successfully_saved_files: Vec::new(),
        errors: HashMap::new(),
        renamed_files: HashMap::new(),
    };
    let target_directory = Path::new(&target_directory);

    for file in files {
        let path = Path::new(&file.path);
        let file_name = match path.file_name() {
            None => {
                result.errors.insert(
                    path.to_str().unwrap().to_string(),
                    "Datei scheint keinen Namen zu haben".to_string(),
                );
                continue;
            }
            Some(name) => name,
        };
        let destination_path = target_directory.join(file_name);
        if destination_path.exists() {
            result.errors.insert(
                path.to_str().unwrap().to_string(),
                "Die Datei existiert bereits".to_string(),
            );
            continue;
        }
        match save_action {
            SaveAction::COPY => match copy(path, destination_path) {
                Err(err) => {
                    result
                        .errors
                        .insert(path.to_str().unwrap().to_string(), err.to_string());
                }
                Ok(_) => {
                    result
                        .successfully_saved_files
                        .push(path.to_str().unwrap().to_string());
                }
            },
            SaveAction::MOVE => match rename(path, &destination_path) {
                Err(err) => {
                    result
                        .errors
                        .insert(path.to_str().unwrap().to_string(), err.to_string());
                }
                Ok(_) => {
                    result
                        .successfully_saved_files
                        .push(path.to_str().unwrap().to_string());
                    result.renamed_files.insert(path.to_str().unwrap().to_string(), destination_path.to_str().unwrap().to_string());
                }
            }
        };
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
        .invoke_handler(tauri::generate_handler![greet, save_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
