use std::sync::Mutex;

use diesel::connection::SimpleConnection;
use diesel::{Connection, SqliteConnection};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use tauri::{AppHandle, Manager};

pub mod schema;
pub mod settings;

/// The `migrations/` directory is compiled into the binary, so a fresh install
/// creates its schema without any external files.
const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

/// Global handle to the application database. Managed as tauri state, so every
/// command can grab the connection via `tauri::State<Database>`. Diesel's
/// `SqliteConnection` is not `Sync`, hence the mutex.
///
/// Tauri never drops managed state (the process ends via `process::exit`), so
/// the connection has to be closed explicitly with [`Database::close`] — the
/// `Option` is what lets us take it out and drop it.
pub struct Database(Mutex<Option<SqliteConnection>>);

impl Database {
    /// Opens (and creates if missing) the sqlite file inside the app data
    /// directory and brings its schema up to the current version.
    pub fn init(app: &AppHandle) -> Result<Self, DatabaseError> {
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| DatabaseError::Path(e.to_string()))?;
        std::fs::create_dir_all(&data_dir).map_err(|e| DatabaseError::Path(e.to_string()))?;

        let database_path = data_dir.join("image-organizer.db");
        let database_url = database_path
            .to_str()
            .ok_or_else(|| DatabaseError::Path(format!("{} ist kein gültiger Pfad", database_path.display())))?;

        let mut connection = SqliteConnection::establish(database_url)?;
        connection.batch_execute("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;
        connection
            .run_pending_migrations(MIGRATIONS)
            .map_err(|e| DatabaseError::Migration(e.to_string()))?;

        Ok(Self(Mutex::new(Some(connection))))
    }

    /// Runs `f` with exclusive access to the connection.
    pub fn with_connection<T>(
        &self,
        f: impl FnOnce(&mut SqliteConnection) -> Result<T, DatabaseError>,
    ) -> Result<T, DatabaseError> {
        let mut connection = self.0.lock().map_err(|_| DatabaseError::Poisoned)?;
        f(connection.as_mut().ok_or(DatabaseError::Closed)?)
    }

    /// Closes the connection. Dropping it runs `sqlite3_close`, which
    /// checkpoints the WAL into the database file and removes the `-wal` and
    /// `-shm` files. Must be called on app exit.
    pub fn close(&self) {
        // a poisoned mutex still holds the connection, so close it anyway
        let mut connection = self.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        connection.take();
    }
}

#[derive(Debug)]
pub enum DatabaseError {
    Path(String),
    Connection(diesel::ConnectionError),
    Query(diesel::result::Error),
    Migration(String),
    /// The connection mutex was poisoned by a panic in another command.
    Poisoned,
    /// The connection was already closed because the app is exiting.
    Closed,
}

impl From<diesel::ConnectionError> for DatabaseError {
    fn from(error: diesel::ConnectionError) -> Self {
        DatabaseError::Connection(error)
    }
}

impl From<diesel::result::Error> for DatabaseError {
    fn from(error: diesel::result::Error) -> Self {
        DatabaseError::Query(error)
    }
}

impl std::fmt::Display for DatabaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DatabaseError::Path(message) => write!(f, "Datenbankverzeichnis nicht verfügbar: {}", message),
            DatabaseError::Connection(error) => write!(f, "Datenbankverbindung fehlgeschlagen: {}", error),
            DatabaseError::Query(error) => write!(f, "Datenbankfehler: {}", error),
            DatabaseError::Migration(message) => write!(f, "Datenbankmigration fehlgeschlagen: {}", message),
            DatabaseError::Poisoned => write!(f, "Datenbankverbindung ist nicht mehr benutzbar"),
            DatabaseError::Closed => write!(f, "Datenbankverbindung wurde bereits geschlossen"),
        }
    }
}

impl std::error::Error for DatabaseError {}

impl serde::Serialize for DatabaseError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Migrations must apply cleanly to an empty database and be a no-op on an
    /// already migrated one.
    #[test]
    fn runs_all_migrations_and_is_idempotent() {
        let mut connection = SqliteConnection::establish(":memory:").unwrap();

        let applied = connection.run_pending_migrations(MIGRATIONS).unwrap();
        assert!(!applied.is_empty());
        assert!(connection.run_pending_migrations(MIGRATIONS).unwrap().is_empty());
        assert!(!connection.has_pending_migration(MIGRATIONS).unwrap());
    }

    /// Closing must merge the WAL back into the database file, so only a single
    /// file remains after the app exits.
    #[test]
    fn close_removes_wal_file() {
        let dir = std::env::temp_dir().join(format!("image-organizer-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let database_path = dir.join("test.db");
        let wal_path = dir.join("test.db-wal");

        let mut connection = SqliteConnection::establish(database_path.to_str().unwrap()).unwrap();
        connection.batch_execute("PRAGMA journal_mode = WAL;").unwrap();
        connection.run_pending_migrations(MIGRATIONS).unwrap();
        let database = Database(Mutex::new(Some(connection)));

        database
            .with_connection(|connection| {
                Ok(connection.batch_execute("INSERT INTO settings (key, value) VALUES ('a', '1');")?)
            })
            .unwrap();
        assert!(wal_path.exists());

        database.close();
        assert!(!wal_path.exists());
        assert!(matches!(database.with_connection(|_| Ok(())), Err(DatabaseError::Closed)));

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
