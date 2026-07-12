use std::collections::HashMap;
use std::path::{Path, PathBuf};

use image::{GrayImage, Luma, Rgb, RgbImage};
use imageproc::geometric_transformations::{warp_into, Border, Interpolation, Projection};
use nalgebra::{Matrix3, Vector3};

use super::error::FaceMergeError;
use super::{image_io, DetectedFace, SessionSnapshot};

// Face boxes are expanded by this factor per side to cover hair and chin.
const BOX_EXPANSION: f32 = 0.4;
// The elliptical mask is fully opaque up to this normalized radius, then feathers out to 1.0.
const FEATHER_START: f32 = 0.65;

pub fn merge(session: &SessionSnapshot, selections: &HashMap<u32, String>) -> Result<String, FaceMergeError> {
    let selected_faces = resolve_selections(session, selections)?;

    let base_path = pick_base_photo(session, &selected_faces)?;
    let base_idx = session.photos.iter().position(|p| p.path == base_path).unwrap();
    let h_base_inv = session.homographies_to_ref[base_idx]
        .try_inverse()
        .ok_or_else(|| FaceMergeError::alignment_failed(&base_path))?;

    let mut base = image_io::load_oriented(&base_path)?;

    // group donor faces by photo so each donor is decoded and warped exactly once
    let mut faces_by_donor: HashMap<&str, Vec<&DetectedFace>> = HashMap::new();
    for face in &selected_faces {
        if face.photo_path != base_path {
            faces_by_donor.entry(&face.photo_path).or_default().push(face);
        }
    }
    if faces_by_donor.is_empty() {
        return Err(FaceMergeError::invalid_selection(
            "Gesichter aus mindestens 2 Fotos auswählen",
        ));
    }

    for (donor_path, faces) in &faces_by_donor {
        let donor_idx = session.photos.iter().position(|p| p.path == *donor_path).unwrap();
        // maps donor coords -> base coords (full resolution, oriented)
        let h_donor_to_base = h_base_inv * session.homographies_to_ref[donor_idx];
        let donor = image_io::load_oriented(donor_path)?;
        let (warped, validity) = warp_donor(&donor, &h_donor_to_base, &base, donor_path)?;
        drop(donor);

        for face in faces {
            // The person may have moved between the shots. Global alignment alone would paste
            // the donor face at the donor's position — offset from the body in the base photo.
            // Anchor on the base photo's face of the same person: shift the donor pixels so the
            // donor face lands exactly on the old head, replacing it.
            let base_face = session
                .faces
                .iter()
                .find(|f| f.person_id == face.person_id && f.photo_path == base_path);
            let donor_box = donor_box_in_base(face, &h_donor_to_base);
            let offset = match base_face {
                Some(base_face) => {
                    let bb = &base_face.face_box;
                    let donor_center = ((donor_box[0] + donor_box[2]) / 2.0, (donor_box[1] + donor_box[3]) / 2.0);
                    (
                        (bb.x + bb.width / 2.0 - donor_center.0).round() as i32,
                        (bb.y + bb.height / 2.0 - donor_center.1).round() as i32,
                    )
                }
                None => (0, 0),
            };
            let roi = face_roi_in_base(donor_box, offset, base_face, base.width(), base.height());
            blend_face(&mut base, &warped, &validity, roi, offset);
        }
    }

    let output_path = unique_output_path(&base_path);
    base.save_with_format(&output_path, image::ImageFormat::Jpeg)
        .map_err(|e| FaceMergeError::output_write(&output_path.to_string_lossy(), e))?;
    Ok(output_path.to_string_lossy().into_owned())
}

// Validates that every selection points at a detected face of that person and returns those faces.
fn resolve_selections<'a>(
    session: &'a SessionSnapshot,
    selections: &HashMap<u32, String>,
) -> Result<Vec<&'a DetectedFace>, FaceMergeError> {
    selections
        .iter()
        .map(|(person_id, photo_path)| {
            session
                .faces
                .iter()
                .find(|f| f.person_id == *person_id && &f.photo_path == photo_path)
                .ok_or_else(|| {
                    FaceMergeError::invalid_selection(format!("Person {} in {}", person_id, photo_path))
                })
        })
        .collect()
}

// The photo contributing the most selected faces becomes the base (fewest transplants).
// Ties resolve to the lowest photo index.
fn pick_base_photo(session: &SessionSnapshot, faces: &[&DetectedFace]) -> Result<String, FaceMergeError> {
    session
        .photos
        .iter()
        .rev() // ties resolve to the lowest photo index (max_by_key keeps the last maximum)
        .max_by_key(|photo| faces.iter().filter(|f| f.photo_path == photo.path).count())
        .map(|photo| photo.path.clone())
        .ok_or(FaceMergeError::SessionExpired)
}

// Warps the donor into the base frame; also produces a validity mask marking pixels
// that actually came from the donor (vs. out-of-bounds black border).
fn warp_donor(
    donor: &RgbImage,
    h: &Matrix3<f64>,
    base: &RgbImage,
    donor_path: &str,
) -> Result<(RgbImage, GrayImage), FaceMergeError> {
    #[rustfmt::skip]
    let matrix = [
        h[(0, 0)] as f32, h[(0, 1)] as f32, h[(0, 2)] as f32,
        h[(1, 0)] as f32, h[(1, 1)] as f32, h[(1, 2)] as f32,
        h[(2, 0)] as f32, h[(2, 1)] as f32, h[(2, 2)] as f32,
    ];
    let projection = Projection::from_matrix(matrix).ok_or_else(|| FaceMergeError::alignment_failed(donor_path))?;

    let mut warped = RgbImage::new(base.width(), base.height());
    warp_into(
        donor,
        projection,
        Interpolation::Bicubic,
        Border::Constant(Rgb([0, 0, 0])),
        &mut warped,
    );

    let white = GrayImage::from_pixel(donor.width(), donor.height(), Luma([255]));
    let mut validity = GrayImage::new(base.width(), base.height());
    warp_into(
        &white,
        projection,
        Interpolation::Nearest,
        Border::Constant(Luma([0])),
        &mut validity,
    );
    Ok((warped, validity))
}

struct Roi {
    x0: u32,
    y0: u32,
    x1: u32,
    y1: u32,
    center: (f32, f32),
    radius: (f32, f32),
}

// The donor face box mapped into the base frame (axis-aligned bounding box of the warped corners).
fn donor_box_in_base(face: &DetectedFace, h: &Matrix3<f64>) -> [f32; 4] {
    let fb = &face.face_box;
    let corners = [
        (fb.x, fb.y),
        (fb.x + fb.width, fb.y),
        (fb.x, fb.y + fb.height),
        (fb.x + fb.width, fb.y + fb.height),
    ];
    let (mut min_x, mut min_y) = (f32::INFINITY, f32::INFINITY);
    let (mut max_x, mut max_y) = (f32::NEG_INFINITY, f32::NEG_INFINITY);
    for (x, y) in corners {
        let p = h * Vector3::new(x as f64, y as f64, 1.0);
        let (px, py) = ((p.x / p.z) as f32, (p.y / p.z) as f32);
        min_x = min_x.min(px);
        min_y = min_y.min(py);
        max_x = max_x.max(px);
        max_y = max_y.max(py);
    }
    [min_x, min_y, max_x, max_y]
}

// Blend region in base coordinates: the donor face box shifted onto the base face position,
// united with the base face box (sizes can differ), expanded.
fn face_roi_in_base(
    donor_box: [f32; 4],
    offset: (i32, i32),
    base_face: Option<&DetectedFace>,
    base_w: u32,
    base_h: u32,
) -> Roi {
    let mut min_x = donor_box[0] + offset.0 as f32;
    let mut min_y = donor_box[1] + offset.1 as f32;
    let mut max_x = donor_box[2] + offset.0 as f32;
    let mut max_y = donor_box[3] + offset.1 as f32;
    if let Some(base_face) = base_face {
        let bb = &base_face.face_box;
        min_x = min_x.min(bb.x);
        min_y = min_y.min(bb.y);
        max_x = max_x.max(bb.x + bb.width);
        max_y = max_y.max(bb.y + bb.height);
    }
    let expand_x = (max_x - min_x) * BOX_EXPANSION;
    let expand_y = (max_y - min_y) * BOX_EXPANSION;
    let (ex0, ey0) = (min_x - expand_x, min_y - expand_y);
    let (ex1, ey1) = (max_x + expand_x, max_y + expand_y);
    Roi {
        x0: ex0.floor().max(0.0) as u32,
        y0: ey0.floor().max(0.0) as u32,
        x1: (ex1.ceil() as i64).clamp(0, base_w as i64) as u32,
        y1: (ey1.ceil() as i64).clamp(0, base_h as i64) as u32,
        center: ((ex0 + ex1) / 2.0, (ey0 + ey1) / 2.0),
        radius: ((ex1 - ex0) / 2.0, (ey1 - ey0) / 2.0),
    }
}

// Alpha-blends the warped donor over the base within an analytically feathered ellipse.
// (Equivalent to a Gaussian-feathered mask, but without blurring a full-resolution buffer.)
// `offset` shifts the donor content: base pixel (x, y) receives donor pixel (x - dx, y - dy),
// placing the donor face onto the base face position when the person moved between shots.
fn blend_face(base: &mut RgbImage, warped: &RgbImage, validity: &GrayImage, roi: Roi, offset: (i32, i32)) {
    if roi.radius.0 <= 0.0 || roi.radius.1 <= 0.0 {
        return;
    }
    for y in roi.y0..roi.y1 {
        for x in roi.x0..roi.x1 {
            let nx = (x as f32 + 0.5 - roi.center.0) / roi.radius.0;
            let ny = (y as f32 + 0.5 - roi.center.1) / roi.radius.1;
            let r = (nx * nx + ny * ny).sqrt();
            let mut alpha = if r <= FEATHER_START {
                1.0
            } else if r >= 1.0 {
                0.0
            } else {
                // smoothstep from 1 at FEATHER_START to 0 at 1.0
                let t = (1.0 - r) / (1.0 - FEATHER_START);
                t * t * (3.0 - 2.0 * t)
            };
            if alpha <= 0.0 {
                continue;
            }
            let sx = x as i64 - offset.0 as i64;
            let sy = y as i64 - offset.1 as i64;
            if sx < 0 || sy < 0 || sx >= warped.width() as i64 || sy >= warped.height() as i64 {
                continue;
            }
            let (sx, sy) = (sx as u32, sy as u32);
            alpha *= validity.get_pixel(sx, sy)[0] as f32 / 255.0;
            if alpha <= 0.0 {
                continue;
            }
            let b = base.get_pixel_mut(x, y);
            let w = warped.get_pixel(sx, sy);
            for c in 0..3 {
                b[c] = (b[c] as f32 * (1.0 - alpha) + w[c] as f32 * alpha).round() as u8;
            }
        }
    }
}

// {stem}_bestshot.jpg next to the base photo, appending _2, _3, ... on collision.
fn unique_output_path(base_path: &str) -> PathBuf {
    let base = Path::new(base_path);
    let dir = base.parent().unwrap_or_else(|| Path::new("."));
    let stem = base.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let first = dir.join(format!("{}_bestshot.jpg", stem));
    if !first.exists() {
        return first;
    }
    (2..)
        .map(|n| dir.join(format!("{}_bestshot_{}.jpg", stem, n)))
        .find(|p| !p.exists())
        .unwrap()
}
