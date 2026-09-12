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

// Opens a file in an external program (e.g. GIMP); without a program, the system default is used.
// On macOS the program is resolved as an application name (`open -a`), elsewhere as a command.
#[tauri::command]
pub async fn open_file_with(path: String, program: Option<String>) -> Result<(), String> {
    let result = match program.as_deref().map(str::trim) {
        Some(program) if !program.is_empty() => open::with_detached(&path, resolve_program(program)),
        _ => open::that_detached(&path),
    };
    result.map_err(|e| format!("Programm konnte nicht gestartet werden: {}", e))
}

#[cfg(not(target_os = "windows"))]
fn resolve_program(program: &str) -> String {
    program.to_string()
}

// Windows only knows executables on PATH or full paths — the display name from
// "Apps & Features" (e.g. "GIMP" / "GIMP 3.2.2") is not one. Map such a name onto the
// real .exe by scanning the usual install roots; falls back to the input unchanged.
#[cfg(target_os = "windows")]
fn resolve_program(program: &str) -> String {
    if Path::new(program).is_file() {
        return program.to_string();
    }
    find_installed_executable(program).unwrap_or_else(|| program.to_string())
}

#[cfg(target_os = "windows")]
fn find_installed_executable(program: &str) -> Option<String> {
    use std::fs::read_dir;

    let wanted = normalize_program_name(program);
    // Too short a name would match almost any directory.
    if wanted.len() < 3 {
        return None;
    }

    let mut roots: Vec<std::path::PathBuf> = ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"]
        .iter()
        .filter_map(|key| std::env::var_os(key))
        .map(std::path::PathBuf::from)
        .collect();
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        roots.push(std::path::PathBuf::from(local).join("Programs"));
    }

    // Newest install first: "GIMP 3" should win over "GIMP 2".
    let mut candidates: Vec<std::path::PathBuf> = roots
        .iter()
        .filter_map(|root| read_dir(root).ok())
        .flatten()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .filter(|entry| {
            let dir = normalize_program_name(&entry.file_name().to_string_lossy());
            !dir.is_empty() && (dir.starts_with(&wanted) || wanted.starts_with(&dir))
        })
        .map(|entry| entry.path())
        .collect();
    candidates.sort();
    candidates.reverse();

    candidates
        .iter()
        .flat_map(|dir| [dir.join("bin"), dir.clone()])
        .find_map(|dir| find_executable_in_dir(&dir, &wanted))
}

// Picks e.g. bin/gimp-3.2.exe, skipping console/debug/uninstaller variants.
#[cfg(target_os = "windows")]
fn find_executable_in_dir(dir: &Path, wanted: &str) -> Option<String> {
    let mut matches: Vec<std::path::PathBuf> = std::fs::read_dir(dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .map(|ext| ext.eq_ignore_ascii_case("exe"))
                .unwrap_or(false)
        })
        .filter(|path| {
            let stem = path
                .file_stem()
                .map(|stem| stem.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if ["console", "uninst", "debug", "setup", "update", "crash"]
                .iter()
                .any(|bad| stem.contains(bad))
            {
                return false;
            }
            let stem = normalize_program_name(&stem);
            stem.starts_with(wanted) || wanted.starts_with(&stem)
        })
        .collect();
    matches.sort_by_key(|path| path.to_string_lossy().len());
    matches
        .first()
        .map(|path| path.to_string_lossy().to_string())
}

// "GIMP 3.2.2" and "gimp-3.2" both collapse to "gimp322"/"gimp32" so prefix matching works.
#[cfg(target_os = "windows")]
fn normalize_program_name(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
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
