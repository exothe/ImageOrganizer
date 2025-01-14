use chrono::{Datelike, NaiveDateTime};
use exif::{Reader, Tag};
use serde::Deserialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
pub struct CreationDateParams {
    format: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortVariant {
    CreationDate(CreationDateParams),
}

fn get_creation_date_from_exif(path: &Path) -> io::Result<chrono::NaiveDateTime> {
    let file = fs::File::open(path)?;
    let reader = Reader::new();
    let exif = reader
        .read_from_container(&mut std::io::BufReader::new(file))
        .map_err(|_| io::Error::new(io::ErrorKind::Other, "Failed to read EXIF metadata"))?;

    let mut date_time_field = exif.get_field(Tag::DateTimeOriginal, exif::In::PRIMARY);

    if let None = date_time_field {
        date_time_field = exif.get_field(Tag::DateTimeDigitized, exif::In::PRIMARY);
    }
    let date_time = date_time_field
        .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "No EXIF creation date found"))?
        .display_value()
        .to_string();

    return chrono::NaiveDateTime::parse_from_str(&date_time, "%Y-%m-%d %H:%M:%S").map_err(|_| {
        std::io::Error::new(io::ErrorKind::Other, "Cannot parse date in exif metadata")
    });
}

fn get_german_month_name(month: u32) -> String {
    match month {
        1 => "Januar".to_owned(),
        2 => "Februar".to_owned(),
        3 => "März".to_owned(),
        4 => "April".to_owned(),
        5 => "Mai".to_owned(),
        6 => "Juni".to_owned(),
        7 => "Juli".to_owned(),
        8 => "August".to_owned(),
        9 => "September".to_owned(),
        10 => "Oktober".to_owned(),
        11 => "November".to_owned(),
        12 => "Dezember".to_owned(),
        _ => panic!("Invalid month given to get_german_month_name"),
    }
}

fn interpolate_date_format(date: NaiveDateTime, format: &str) -> String {
    let mut formatted_string = format.replace("%Y", &date.format("%Y").to_string());
    formatted_string = formatted_string.replace("%y", &date.format("%y").to_string());
    formatted_string = formatted_string.replace("%m", &date.format("%m").to_string());
    formatted_string = formatted_string.replace("%B", &get_german_month_name(date.month()));

    return formatted_string;
}

pub fn sort_files(
    sort_variant: SortVariant,
    file_paths: Vec<&Path>,
    target_directory: &Path,
) -> std::io::Result<Vec<PathBuf>> {
    let mut new_paths = Vec::new();

    match sort_variant {
        SortVariant::CreationDate(params) => {
            for path in file_paths {
                let date_time = get_creation_date_from_exif(path);

                let date_time = if let Ok(date_time) = date_time {
                    date_time
                } else {
                    let metadata = fs::metadata(path)?;
                    let created_time = metadata.created()?;
                    let date_time: chrono::DateTime<chrono::Local> = created_time.into();
                    date_time.naive_local()
                };

                let directory_name = interpolate_date_format(date_time, &params.format);
                let mut new_path = target_directory.join(directory_name);
                fs::create_dir_all(&new_path)?;

                new_path.push(
                    path.file_name()
                        .ok_or_else(|| io::Error::new(io::ErrorKind::Other, "File has no name"))?,
                );

                new_paths.push(new_path);
            }
        }
    };

    return Ok(new_paths);
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::prelude::*;

    fn create_naive_date_time(year: i32, month: u32, day: u32) -> NaiveDateTime {
        chrono::prelude::Utc
            .with_ymd_and_hms(year, month, day, 0, 0, 0)
            .unwrap()
            .naive_local()
    }

    #[test]
    fn test_interpolate_date_format() {
        assert_eq!(
            "2024",
            interpolate_date_format(create_naive_date_time(2024, 12, 1), "%Y")
        );
        assert_eq!(
            "Hello: 2024",
            interpolate_date_format(create_naive_date_time(2024, 12, 30), "Hello: %Y")
        );

        assert_eq!(
            "Hello: 24",
            interpolate_date_format(create_naive_date_time(2024, 12, 30), "Hello: %y")
        );

        assert_eq!(
            "Year 2024 Month 12",
            interpolate_date_format(create_naive_date_time(2024, 12, 30), "Year %Y Month %m")
        );
        assert_eq!(
            "Year 2024 Month 03",
            interpolate_date_format(create_naive_date_time(2024, 3, 30), "Year %Y Month %m")
        );

        assert_eq!(
            "Year 2024 Month Dezember",
            interpolate_date_format(create_naive_date_time(2024, 12, 30), "Year %Y Month %B")
        );
        assert_eq!(
            "Year 2024 Month März",
            interpolate_date_format(create_naive_date_time(2024, 3, 30), "Year %Y Month %B")
        );
    }

    #[test]
    fn test_get_creation_date_from_exif() {
        let creation_date =
            get_creation_date_from_exif(&Path::new("./test/image-created-2023-05.jpg")).unwrap();
        assert_eq!(
            creation_date.date(),
            create_naive_date_time(2023, 05, 22).date()
        );

        let creation_date =
            get_creation_date_from_exif(&Path::new("./test/image-created-2024-12.jpg")).unwrap();
        assert_eq!(
            creation_date.date(),
            create_naive_date_time(2024, 12, 22).date()
        );
    }

    #[test]
    fn test_sort_files_creation_year_month() {
        let paths_option = sort_files(
            SortVariant::CreationDate(CreationDateParams {
                format: "%Y_%m".to_owned(),
            }),
            vec![Path::new("./test/image-created-2023-05.jpg")],
            Path::new("./new_dir"),
        );

        match paths_option {
            Err(_) => {
                panic!("Should get something");
            }
            Ok(paths) => {
                assert_eq!(paths.len(), 1);
                assert_eq!(
                    paths[0],
                    PathBuf::from("./new_dir/2023_05/image-created-2023-05.jpg")
                );
            }
        }
    }

    #[test]
    fn test_sort_files_creation_year_month_no_exif() {
        let paths_option = sort_files(
            SortVariant::CreationDate(CreationDateParams {
                format: "%Y_%m".to_owned(),
            }),
            vec![Path::new("./test/file1.txt")],
            Path::new("./new_dir"),
        );

        match paths_option {
            Err(_) => {
                panic!("Should get something");
            }
            Ok(paths) => {
                assert_eq!(paths.len(), 1);
                assert_eq!(paths[0], PathBuf::from("./new_dir/2024_12/file1.txt"));
            }
        }
    }
}
