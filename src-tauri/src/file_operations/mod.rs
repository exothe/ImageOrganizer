use serde::Deserialize;
use std::collections::HashMap;
use std::fs::{copy, rename};
use std::path::Path;

mod file_sorting;

#[derive(serde::Serialize)]
pub struct SaveResult {
    successfully_saved_files: Vec<String>,
    errors: HashMap<String, String>,
    global_errors: Vec<String>,
    renamed_files: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SaveAction {
    COPY,
    MOVE,
}

#[derive(Debug, Deserialize)]
pub struct UserFile {
    path: String,
    tag: Option<String>,
}

#[tauri::command]
pub async fn save_files(
    files: Vec<UserFile>,
    target_directory: String,
    save_action: SaveAction,
    sort_variant: Option<file_sorting::SortVariant>,
) -> SaveResult {
    let mut result = SaveResult {
        successfully_saved_files: Vec::new(),
        errors: HashMap::new(),
        global_errors: Vec::new(),
        renamed_files: HashMap::new(),
    };
    let target_directory = Path::new(&target_directory);

    // get the target paths if there is a sort variant, by invoking the respective function. If
    // some error occurs, we return it immediately in the save result.
    let target_paths = if let Some(sort_variant) = sort_variant {
        let paths = file_sorting::sort_files(
            sort_variant,
            files.iter().map(|file| Path::new(&file.path)).collect(),
            target_directory,
        );
        match paths {
            Ok(paths) => Some(paths),
            Err(_) => {
                result.global_errors.push("Die Ordner, welche zum sortieren erstellt werden sollten, konnten nicht erzeugt werden".to_owned());
                return result;
            }
        }
    } else {
        None
    };

    for (i, file) in files.iter().enumerate() {
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
        let destination_path = if let Some(target_paths) = &target_paths {
            target_paths[i].clone()
        } else {
            target_directory.join(file_name)
        };

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
                    result.renamed_files.insert(
                        path.to_str().unwrap().to_string(),
                        destination_path.to_str().unwrap().to_string(),
                    );
                }
            },
        };
    }

    return result;
}

#[derive(serde::Serialize)]
pub struct RemoveResult {
    success: bool,
    failed_files: Vec<String>,
}

#[tauri::command]
pub async fn save_delete_files(files: Vec<UserFile>) -> RemoveResult {
    let mut result = RemoveResult {
        success: true,
        failed_files: vec![],
    };
    for file in files {
        if let Err(_) = trash::delete(&file.path) {
            result.failed_files.push(file.path);
            result.success = false;
        }
    }

    return result;
}
