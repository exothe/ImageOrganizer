use std::collections::HashMap;

use diesel::prelude::*;
use serde_json::Value;

use super::schema::settings;
use super::{Database, DatabaseError};

/// Every setting is one row, holding its JSON encoded value. Storing them
/// per key (instead of one blob) keeps settings added in later versions on
/// their frontend default until the user changes them.
#[derive(Queryable, Selectable, Insertable)]
#[diesel(table_name = settings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
struct Setting {
    key: String,
    value: String,
}

#[tauri::command]
pub fn get_settings(database: tauri::State<Database>) -> Result<HashMap<String, Value>, DatabaseError> {
    let mut connection = database.0.lock().map_err(|_| DatabaseError::Poisoned)?;
    let rows: Vec<Setting> = settings::table.select(Setting::as_select()).load(&mut *connection)?;

    Ok(rows
        .into_iter()
        // A value we cannot parse is a leftover of an older format — skip it
        // so the frontend falls back to its default instead of failing.
        .filter_map(|row| serde_json::from_str(&row.value).ok().map(|value| (row.key, value)))
        .collect())
}

#[tauri::command]
pub fn set_settings(
    database: tauri::State<Database>,
    new_settings: HashMap<String, Value>,
) -> Result<(), DatabaseError> {
    let rows: Vec<Setting> = new_settings
        .into_iter()
        .map(|(key, value)| Setting {
            key,
            value: value.to_string(),
        })
        .collect();

    let mut connection = database.0.lock().map_err(|_| DatabaseError::Poisoned)?;
    connection.transaction(|connection| {
        for row in rows {
            diesel::insert_into(settings::table)
                .values(&row)
                .on_conflict(settings::key)
                .do_update()
                .set(settings::value.eq(&row.value))
                .execute(connection)?;
        }
        Ok::<_, diesel::result::Error>(())
    })?;

    Ok(())
}
