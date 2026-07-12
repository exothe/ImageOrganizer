use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum FaceMergeError {
    Io(String),
    UnsupportedFormat(String),
    ModelLoad(String),
    AlignmentFailed(String),
    NoFacesFound,
    SessionExpired,
    InvalidSelection(String),
    OutputWrite(String),
}

impl FaceMergeError {
    pub fn io(path: &str, err: impl std::fmt::Display) -> Self {
        FaceMergeError::Io(format!("Datei konnte nicht gelesen werden: {} ({})", path, err))
    }

    pub fn unsupported_format(path: &str) -> Self {
        FaceMergeError::UnsupportedFormat(format!("Dateiformat wird nicht unterstützt: {}", path))
    }

    pub fn model_load(err: impl std::fmt::Display) -> Self {
        FaceMergeError::ModelLoad(format!("Gesichtserkennungsmodell konnte nicht geladen werden: {}", err))
    }

    pub fn alignment_failed(path: &str) -> Self {
        FaceMergeError::AlignmentFailed(format!(
            "Die Fotos sind zu unterschiedlich und können nicht überlagert werden: {}",
            path
        ))
    }

    pub fn invalid_selection(detail: impl std::fmt::Display) -> Self {
        FaceMergeError::InvalidSelection(format!("Ungültige Gesichtsauswahl: {}", detail))
    }

    pub fn output_write(path: &str, err: impl std::fmt::Display) -> Self {
        FaceMergeError::OutputWrite(format!("Ergebnis konnte nicht gespeichert werden: {} ({})", path, err))
    }
}
