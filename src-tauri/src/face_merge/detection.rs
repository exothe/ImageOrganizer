use image::RgbImage;
use tract_onnx::prelude::*;

use super::error::FaceMergeError;

const SCORE_THRESHOLD: f32 = 0.6;
const NMS_IOU_THRESHOLD: f32 = 0.3;
const STRIDES: [usize; 3] = [8, 16, 32];

#[derive(Debug, Clone, Copy)]
pub struct RawFace {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub score: f32,
}

pub struct FaceDetector {
    // Kept as an inference model; a concrete plan is built per call because
    // YuNet is fully convolutional and input dimensions vary per photo.
    model: InferenceModel,
}

impl FaceDetector {
    pub fn load(path: &std::path::Path) -> Result<Self, FaceMergeError> {
        let model = tract_onnx::onnx()
            .model_for_path(path)
            .and_then(|m| {
                // Fix output order deterministically: cls/obj/bbox per stride (kps unused).
                m.with_outputs_by_name([
                    "cls_8", "cls_16", "cls_32", "obj_8", "obj_16", "obj_32", "bbox_8", "bbox_16", "bbox_32",
                ])
            })
            .map_err(FaceMergeError::model_load)?;
        Ok(FaceDetector { model })
    }

    // Detects faces; returned coordinates are in the coordinate space of `img`.
    pub fn detect(&self, img: &RgbImage) -> Result<Vec<RawFace>, FaceMergeError> {
        // pad right/bottom to multiples of 32
        let (w, h) = (img.width() as usize, img.height() as usize);
        let padded_w = w.div_ceil(32) * 32;
        let padded_h = h.div_ceil(32) * 32;

        // YuNet expects BGR float32, raw 0-255, NCHW
        let mut input = tract_ndarray::Array4::<f32>::zeros((1, 3, padded_h, padded_w));
        for (x, y, pixel) in img.enumerate_pixels() {
            let (x, y) = (x as usize, y as usize);
            input[[0, 0, y, x]] = pixel[2] as f32; // B
            input[[0, 1, y, x]] = pixel[1] as f32; // G
            input[[0, 2, y, x]] = pixel[0] as f32; // R
        }

        let plan = self
            .model
            .clone()
            .with_input_fact(0, f32::fact([1, 3, padded_h, padded_w]).into())
            .and_then(|m| m.into_optimized())
            .and_then(|m| m.into_runnable())
            .map_err(FaceMergeError::model_load)?;

        let outputs = plan
            .run(tvec!(Tensor::from(input).into()))
            .map_err(|e| FaceMergeError::ModelLoad(format!("Gesichtserkennung fehlgeschlagen: {}", e)))?;

        let mut candidates = Vec::new();
        for (stride_idx, &stride) in STRIDES.iter().enumerate() {
            let cls = outputs[stride_idx]
                .to_plain_array_view::<f32>()
                .map_err(FaceMergeError::model_load)?;
            let obj = outputs[3 + stride_idx]
                .to_plain_array_view::<f32>()
                .map_err(FaceMergeError::model_load)?;
            let bbox = outputs[6 + stride_idx]
                .to_plain_array_view::<f32>()
                .map_err(FaceMergeError::model_load)?;
            let cls = cls.as_slice().unwrap_or(&[]);
            let obj = obj.as_slice().unwrap_or(&[]);
            let bbox = bbox.as_slice().unwrap_or(&[]);

            let grid_w = padded_w / stride;
            for (i, (&c, &o)) in cls.iter().zip(obj.iter()).enumerate() {
                let score = (c.clamp(0.0, 1.0) * o.clamp(0.0, 1.0)).sqrt();
                if score < SCORE_THRESHOLD {
                    continue;
                }
                let (row, col) = (i / grid_w, i % grid_w);
                let cx = (col as f32 + bbox[i * 4]) * stride as f32;
                let cy = (row as f32 + bbox[i * 4 + 1]) * stride as f32;
                let bw = bbox[i * 4 + 2].exp() * stride as f32;
                let bh = bbox[i * 4 + 3].exp() * stride as f32;
                candidates.push(RawFace {
                    x: cx - bw / 2.0,
                    y: cy - bh / 2.0,
                    width: bw,
                    height: bh,
                    score,
                });
            }
        }

        Ok(nms(candidates))
    }
}

fn iou(a: &RawFace, b: &RawFace) -> f32 {
    let x1 = a.x.max(b.x);
    let y1 = a.y.max(b.y);
    let x2 = (a.x + a.width).min(b.x + b.width);
    let y2 = (a.y + a.height).min(b.y + b.height);
    let inter = (x2 - x1).max(0.0) * (y2 - y1).max(0.0);
    let union = a.width * a.height + b.width * b.height - inter;
    if union <= 0.0 {
        0.0
    } else {
        inter / union
    }
}

fn nms(mut candidates: Vec<RawFace>) -> Vec<RawFace> {
    candidates.sort_by(|a, b| b.score.total_cmp(&a.score));
    let mut kept: Vec<RawFace> = Vec::new();
    for candidate in candidates {
        if kept.iter().all(|k| iou(k, &candidate) < NMS_IOU_THRESHOLD) {
            kept.push(candidate);
        }
    }
    kept
}

#[cfg(test)]
mod tests {
    use super::*;

    fn model_path() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/face_detection_yunet_2023mar.onnx")
    }

    // op-coverage gate: tract must be able to load, optimize and run the YuNet graph
    #[test]
    fn yunet_runs_under_tract() {
        let detector = FaceDetector::load(&model_path()).expect("model loads");
        let blank = RgbImage::from_pixel(320, 240, image::Rgb([128, 128, 128]));
        let faces = detector.detect(&blank).expect("inference runs");
        assert!(faces.is_empty(), "blank image must contain no faces");
    }

    // manual sanity check on a real photo: FACE_TEST_IMAGE=/path/to/photo.jpg cargo test yunet_detects -- --ignored --nocapture
    #[test]
    #[ignore]
    fn yunet_detects_faces_in_real_photo() {
        let path = std::env::var("FACE_TEST_IMAGE").expect("set FACE_TEST_IMAGE");
        let img = crate::face_merge::image_io::load_oriented(&path).expect("image loads");
        let (small, _) = crate::face_merge::image_io::downscale(&img, crate::face_merge::image_io::WORKING_LONG_EDGE);
        let detector = FaceDetector::load(&model_path()).expect("model loads");
        let faces = detector.detect(&small).expect("inference runs");
        println!("detected {} faces: {:?}", faces.len(), faces);
        assert!(!faces.is_empty(), "expected at least one face");
    }
}
