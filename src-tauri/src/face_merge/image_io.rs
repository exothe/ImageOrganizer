use image::{DynamicImage, ImageDecoder, ImageReader, RgbImage};

use super::error::FaceMergeError;

// Long edge of the downscaled working copies used for feature matching and face detection.
pub const WORKING_LONG_EDGE: u32 = 1600;

// Decodes an image and applies its EXIF orientation, so all downstream coordinates
// are in the same oriented pixel space that the webview displays.
pub fn load_oriented(path: &str) -> Result<RgbImage, FaceMergeError> {
    let reader = ImageReader::open(path)
        .map_err(|e| FaceMergeError::io(path, e))?
        .with_guessed_format()
        .map_err(|e| FaceMergeError::io(path, e))?;
    if reader.format().is_none() {
        return Err(FaceMergeError::unsupported_format(path));
    }
    let mut decoder = reader
        .into_decoder()
        .map_err(|_| FaceMergeError::unsupported_format(path))?;
    let orientation = decoder
        .orientation()
        .unwrap_or(image::metadata::Orientation::NoTransforms);
    let mut img = DynamicImage::from_decoder(decoder).map_err(|_| FaceMergeError::unsupported_format(path))?;
    img.apply_orientation(orientation);
    Ok(img.into_rgb8())
}

// Returns the downscaled image and the scale factor such that
// downscaled_coord = original_coord * scale (scale <= 1.0).
pub fn downscale(img: &RgbImage, long_edge: u32) -> (RgbImage, f64) {
    let max_dim = img.width().max(img.height());
    if max_dim <= long_edge {
        return (img.clone(), 1.0);
    }
    let scale = long_edge as f64 / max_dim as f64;
    let new_w = (img.width() as f64 * scale).round().max(1.0) as u32;
    let new_h = (img.height() as f64 * scale).round().max(1.0) as u32;
    let small = image::imageops::resize(img, new_w, new_h, image::imageops::FilterType::Triangle);
    (small, scale)
}

pub fn to_gray(img: &RgbImage) -> image::GrayImage {
    image::imageops::grayscale(img)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn downscale_keeps_small_images() {
        let img = RgbImage::new(800, 600);
        let (small, scale) = downscale(&img, WORKING_LONG_EDGE);
        assert_eq!((small.width(), small.height()), (800, 600));
        assert_eq!(scale, 1.0);
    }

    #[test]
    fn downscale_limits_long_edge() {
        let img = RgbImage::new(4000, 3000);
        let (small, scale) = downscale(&img, WORKING_LONG_EDGE);
        assert_eq!(small.width(), 1600);
        assert_eq!(small.height(), 1200);
        assert!((scale - 0.4).abs() < 1e-9);
    }
}
