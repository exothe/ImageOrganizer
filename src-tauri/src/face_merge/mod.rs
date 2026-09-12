mod alignment;
mod clustering;
mod compositing;
mod detection;
mod error;
mod image_io;
mod ora;

use std::collections::HashMap;
use std::sync::Mutex;

use nalgebra::Matrix3;
use serde::Serialize;
use tauri::Manager;

pub use error::FaceMergeError;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct FaceBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct DetectedFace {
    pub photo_path: String,
    pub person_id: u32,
    pub face_box: FaceBox,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct PhotoInfo {
    pub path: String,
    // oriented (EXIF-rotated) dimensions, matching what the webview displays
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize)]
pub struct DetectFacesResult {
    pub session_id: u64,
    pub photos: Vec<PhotoInfo>,
    pub faces: Vec<DetectedFace>,
    pub alignment_inliers: Vec<u32>,
}

#[derive(Debug, Serialize)]
pub struct MergeFacesResult {
    pub output_path: String,
}

pub struct FaceMergeSession {
    pub session_id: u64,
    pub photos: Vec<PhotoInfo>,
    // homography mapping full-res oriented coords of photo i into photo 0's frame; identity for i = 0
    pub homographies_to_ref: Vec<Matrix3<f64>>,
    pub faces: Vec<DetectedFace>,
}

#[derive(Default)]
pub struct FaceMergeState {
    session: Mutex<Option<FaceMergeSession>>,
    next_session_id: Mutex<u64>,
}

#[tauri::command]
pub async fn detect_merge_faces(
    app: tauri::AppHandle,
    state: tauri::State<'_, FaceMergeState>,
    paths: Vec<String>,
) -> Result<DetectFacesResult, FaceMergeError> {
    if paths.len() < 2 {
        return Err(FaceMergeError::invalid_selection("mindestens 2 Fotos erforderlich"));
    }
    let model_path = app
        .path()
        .resolve("resources/face_detection_yunet_2023mar.onnx", tauri::path::BaseDirectory::Resource)
        .map_err(FaceMergeError::model_load)?;

    let session_id = {
        let mut next = state.next_session_id.lock().unwrap();
        *next += 1;
        *next
    };

    let (result, session) =
        tauri::async_runtime::spawn_blocking(move || run_detection(session_id, &model_path, &paths))
            .await
            .map_err(|e| FaceMergeError::Io(format!("Interner Fehler: {}", e)))??;

    *state.session.lock().unwrap() = Some(session);
    Ok(result)
}

#[tauri::command]
pub async fn merge_faces(
    state: tauri::State<'_, FaceMergeState>,
    session_id: u64,
    selections: HashMap<u32, String>,
) -> Result<MergeFacesResult, FaceMergeError> {
    let session_data = {
        let guard = state.session.lock().unwrap();
        match guard.as_ref() {
            Some(s) if s.session_id == session_id => SessionSnapshot::from(s),
            _ => return Err(FaceMergeError::SessionExpired),
        }
    };

    let output_path =
        tauri::async_runtime::spawn_blocking(move || compositing::merge(&session_data, &selections))
            .await
            .map_err(|e| FaceMergeError::Io(format!("Interner Fehler: {}", e)))??;

    Ok(MergeFacesResult { output_path })
}

// Same merge, but written as a layered OpenRaster project (base photo + one layer per
// transplanted face) for manual adjustment in GIMP/Krita.
#[tauri::command]
pub async fn merge_faces_ora(
    state: tauri::State<'_, FaceMergeState>,
    session_id: u64,
    selections: HashMap<u32, String>,
) -> Result<MergeFacesResult, FaceMergeError> {
    let session_data = {
        let guard = state.session.lock().unwrap();
        match guard.as_ref() {
            Some(s) if s.session_id == session_id => SessionSnapshot::from(s),
            _ => return Err(FaceMergeError::SessionExpired),
        }
    };

    let output_path =
        tauri::async_runtime::spawn_blocking(move || compositing::merge_ora(&session_data, &selections))
            .await
            .map_err(|e| FaceMergeError::Io(format!("Interner Fehler: {}", e)))??;

    Ok(MergeFacesResult { output_path })
}

// Owned copy of the session so the blocking task doesn't borrow the managed state.
pub struct SessionSnapshot {
    pub photos: Vec<PhotoInfo>,
    pub homographies_to_ref: Vec<Matrix3<f64>>,
    pub faces: Vec<DetectedFace>,
}

impl From<&FaceMergeSession> for SessionSnapshot {
    fn from(s: &FaceMergeSession) -> Self {
        SessionSnapshot {
            photos: s.photos.clone(),
            homographies_to_ref: s.homographies_to_ref.clone(),
            faces: s.faces.clone(),
        }
    }
}

fn run_detection(
    session_id: u64,
    model_path: &std::path::Path,
    paths: &[String],
) -> Result<(DetectFacesResult, FaceMergeSession), FaceMergeError> {
    let mut photos = Vec::new();
    let mut downscaled = Vec::new();
    let mut scales = Vec::new();

    for path in paths {
        let full = image_io::load_oriented(path)?;
        photos.push(PhotoInfo {
            path: path.clone(),
            width: full.width(),
            height: full.height(),
        });
        let (small, scale) = image_io::downscale(&full, image_io::WORKING_LONG_EDGE);
        downscaled.push(small);
        scales.push(scale);
        // full-res pixels dropped here; only the downscaled working copy is kept
    }

    // homographies (downscaled coords): photo i -> photo 0
    let mut homographies_to_ref = vec![Matrix3::identity()];
    let mut alignment_inliers = Vec::new();
    for i in 1..downscaled.len() {
        let (h_ds, inliers) = alignment::align(&downscaled[i], &downscaled[0])
            .ok_or_else(|| FaceMergeError::alignment_failed(&photos[i].path))?;
        // rescale to full-res oriented coords: H_full = S_ref * H_ds * S_i^-1
        let s_ref = Matrix3::new(1.0 / scales[0], 0.0, 0.0, 0.0, 1.0 / scales[0], 0.0, 0.0, 0.0, 1.0);
        let s_i_inv = Matrix3::new(scales[i], 0.0, 0.0, 0.0, scales[i], 0.0, 0.0, 0.0, 1.0);
        homographies_to_ref.push(s_ref * h_ds * s_i_inv);
        alignment_inliers.push(inliers);
    }

    let detector = detection::FaceDetector::load(model_path)?;
    let mut faces_per_photo = Vec::new();
    for (i, small) in downscaled.iter().enumerate() {
        let mut faces = detector.detect(small)?;
        for face in &mut faces {
            face.x /= scales[i] as f32;
            face.y /= scales[i] as f32;
            face.width /= scales[i] as f32;
            face.height /= scales[i] as f32;
        }
        faces_per_photo.push(faces);
    }

    if faces_per_photo.iter().all(|f| f.is_empty()) {
        return Err(FaceMergeError::NoFacesFound);
    }

    let faces = clustering::cluster_faces(&photos, &faces_per_photo, &homographies_to_ref);

    let session = FaceMergeSession {
        session_id,
        photos: photos.clone(),
        homographies_to_ref,
        faces: faces.clone(),
    };
    let result = DetectFacesResult {
        session_id,
        photos,
        faces,
        alignment_inliers,
    };
    Ok((result, session))
}

#[cfg(test)]
mod tests {
    use super::*;

    // full pipeline on a real photo:
    // FACE_TEST_IMAGE=/path/to/face.jpg cargo test full_pipeline -- --ignored --nocapture
    #[test]
    #[ignore]
    fn full_pipeline_detect_and_merge() {
        let source = std::env::var("FACE_TEST_IMAGE").expect("set FACE_TEST_IMAGE");
        let model_path =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/face_detection_yunet_2023mar.onnx");
        let dir = std::env::temp_dir().join("face_merge_e2e");
        std::fs::create_dir_all(&dir).unwrap();

        // two-person group shot: the source face and its mirrored twin side by side
        // (mirrored so the two "persons" don't have identical features, which would
        // let the feature matcher lock one tile onto the other)
        let single = image_io::load_oriented(&source).unwrap();
        let mirrored = image::imageops::flip_horizontal(&single);
        let mut img = image::RgbImage::new(single.width() * 3, single.height());
        image::imageops::overlay(&mut img, &single, 0, 0);
        image::imageops::overlay(&mut img, &mirrored, single.width() as i64, 0);

        // photo A: original; photo B: camera shifted + brightened, and "person 2" moved 60px
        // to the right between the shots (tests the face anchoring)
        let path_a = dir.join("a.jpg");
        let path_b = dir.join("b.jpg");
        img.save(&path_a).unwrap();
        image::imageops::overlay(&mut img, &image::RgbImage::from_pixel(single.width(), single.height(), image::Rgb([180, 180, 180])), single.width() as i64, 0);
        image::imageops::overlay(&mut img, &mirrored, single.width() as i64 + 60, 0);
        let shifted = imageproc::geometric_transformations::warp(
            &img,
            imageproc::geometric_transformations::Projection::translate(8.0, 5.0),
            imageproc::geometric_transformations::Interpolation::Bilinear,
            imageproc::geometric_transformations::Border::Replicate,
        );
        let brightened = image::RgbImage::from_fn(shifted.width(), shifted.height(), |x, y| {
            let p = shifted.get_pixel(x, y);
            image::Rgb([
                p[0].saturating_add(20),
                p[1].saturating_add(20),
                p[2].saturating_add(20),
            ])
        });
        brightened.save(&path_b).unwrap();

        let paths = vec![
            path_a.to_string_lossy().into_owned(),
            path_b.to_string_lossy().into_owned(),
        ];
        let (result, session) = run_detection(1, &model_path, &paths).expect("detection runs");
        println!("faces: {:?}", result.faces);
        println!("inliers: {:?}", result.alignment_inliers);
        assert!(!result.faces.is_empty());

        // both photos must show both persons; identify them by x position in photo A
        let mut faces_a: Vec<&DetectedFace> = result.faces.iter().filter(|f| f.photo_path == paths[0]).collect();
        faces_a.sort_by(|a, b| a.face_box.x.total_cmp(&b.face_box.x));
        assert_eq!(faces_a.len(), 2, "expected two faces in photo A: {:?}", result.faces);
        let (left, right) = (faces_a[0], faces_a[1]);
        assert!(
            result
                .faces
                .iter()
                .any(|f| f.photo_path == paths[1] && f.person_id == right.person_id),
            "moved person must cluster across photos: {:?}",
            result.faces
        );

        // left person keeps base photo A, the moved right person is transplanted from photo B
        let mut selections = HashMap::new();
        selections.insert(left.person_id, paths[0].clone());
        selections.insert(right.person_id, paths[1].clone());

        let snapshot = SessionSnapshot::from(&session);
        let output = compositing::merge(&snapshot, &selections).expect("merge runs");
        println!("output: {}", output);
        assert!(std::path::Path::new(&output).exists());
        let merged = image_io::load_oriented(&output).expect("output decodes");
        assert_eq!((merged.width(), merged.height()), (img.width(), img.height()));

        // anchoring: the (brightened) donor face must land on the base face position,
        // not 60px to the right where the person stood in photo B
        let base_a = image_io::load_oriented(&paths[0]).unwrap();
        let cx = (right.face_box.x + right.face_box.width / 2.0) as u32;
        let cy = (right.face_box.y + right.face_box.height / 2.0) as u32;
        let mut diff_sum = 0i64;
        let mut brightness_sum = 0i64;
        for dy in 0..20 {
            for dx in 0..20 {
                let p_merged = merged.get_pixel(cx + dx - 10, cy + dy - 10);
                let p_base = base_a.get_pixel(cx + dx - 10, cy + dy - 10);
                for c in 0..3 {
                    diff_sum += (p_merged[c] as i64 - p_base[c] as i64).abs();
                    brightness_sum += p_merged[c] as i64 - p_base[c] as i64;
                }
            }
        }
        let mean_brightness_gain = brightness_sum as f64 / (20.0 * 20.0 * 3.0);
        println!("mean brightness gain at base face center: {:.1}", mean_brightness_gain);
        assert!(
            mean_brightness_gain > 10.0,
            "base face center should contain the brightened donor face (gain {:.1})",
            mean_brightness_gain
        );
        let _ = diff_sum;

        // ORA export of the same merge: layered project with base + one face layer
        let ora_output = compositing::merge_ora(&snapshot, &selections).expect("ora export runs");
        println!("ora output: {}", ora_output);
        assert!(ora_output.ends_with(".ora"));
        let file = std::fs::File::open(&ora_output).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        assert_eq!(archive.by_index(0).unwrap().name(), "mimetype");
        let mut xml = String::new();
        std::io::Read::read_to_string(&mut archive.by_name("stack.xml").unwrap(), &mut xml).unwrap();
        println!("stack.xml:\n{}", xml);
        assert!(xml.contains("data/layer1.png"), "expected one face layer: {}", xml);
        assert!(!xml.contains("data/layer2.png"), "expected exactly one face layer: {}", xml);
    }
}
