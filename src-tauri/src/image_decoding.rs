// Fallback for image formats the webview can't display natively (currently JPEG XL on WebView2
// and most WebKitGTK builds). The frontend points <img> tags at the `decoded://` URI scheme, which
// decodes the file here and serves it as JPEG.
use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, ImageResult};
use jxl_oxide::integration::JxlDecoder;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use tauri::http::{Request, Response, StatusCode};
use tauri::UriSchemeResponder;

pub const URI_SCHEME: &str = "decoded";

const JPEG_QUALITY: u8 = 90;

pub fn is_jxl(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("jxl"))
}

// JPEG XL stores the orientation in the codestream and jxl-oxide applies it while decoding.
// The spec says Exif orientation must be ignored, so it is deliberately not applied again here.
pub fn decode_jxl(path: &Path) -> ImageResult<DynamicImage> {
    let decoder = JxlDecoder::new(BufReader::new(File::open(path)?))?;
    DynamicImage::from_decoder(decoder)
}

// `max_size` bounds both edges (aspect ratio is kept), used for small previews.
fn decode_to_jpeg(path: &Path, max_size: Option<u32>) -> ImageResult<Vec<u8>> {
    let mut img = decode_jxl(path)?;
    if let Some(max_size) = max_size {
        if img.width() > max_size || img.height() > max_size {
            img = img.thumbnail(max_size, max_size);
        }
    }
    let mut jpeg = Vec::new();
    // JPEG has no alpha channel and only 8 bit, so normalize whatever the decoder produced
    DynamicImage::ImageRgb8(img.into_rgb8())
        .write_with_encoder(JpegEncoder::new_with_quality(&mut jpeg, JPEG_QUALITY))?;
    Ok(jpeg)
}

// Request URL: decoded://localhost/<percent-encoded file path>[?max=<pixels>]
pub fn handle_request(request: Request<Vec<u8>>, responder: UriSchemeResponder) {
    let path = percent_encoding::percent_decode_str(request.uri().path().trim_start_matches('/'))
        .decode_utf8_lossy()
        .into_owned();
    let max_size = request.uri().query().and_then(|query| {
        query
            .split('&')
            .find_map(|param| param.strip_prefix("max="))
            .and_then(|value| value.parse().ok())
    });

    // decoding takes a while, so keep it off the webview's thread
    std::thread::spawn(move || {
        let path = Path::new(&path);
        let response = if !is_jxl(path) {
            Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(b"unsupported format".to_vec())
        } else {
            match decode_to_jpeg(path, max_size) {
                Ok(jpeg) => Response::builder()
                    .header("Content-Type", "image/jpeg")
                    .body(jpeg),
                Err(e) => Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(e.to_string().into_bytes()),
            }
        };
        responder.respond(response.unwrap());
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    // same 1x1 image the frontend uses to detect native JPEG XL support
    const PROBE_JXL: &[u8] = &[
        0xff, 0x0a, 0x00, 0x10, 0x0c, 0x04, 0xc5, 0x8d, 0x08, 0x00, 0x01, 0x00, 0x1c, 0x00, 0x4b,
        0x18, 0x8b, 0x15, 0xc2, 0x10, 0x0e,
    ];

    #[test]
    fn decodes_jxl_to_jpeg() {
        let dir = std::env::temp_dir().join("image-organizer-jxl-test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("probe.JXL");
        std::fs::write(&path, PROBE_JXL).unwrap();

        let jpeg = decode_to_jpeg(&path, None).unwrap();
        let decoded = image::load_from_memory_with_format(&jpeg, image::ImageFormat::Jpeg).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (1, 1));
    }

    #[test]
    fn detects_jxl_by_extension() {
        assert!(is_jxl(Path::new("/a/b.jxl")));
        assert!(is_jxl(Path::new("C:\\a\\b.JXL")));
        assert!(!is_jxl(Path::new("/a/b.jpg")));
        assert!(!is_jxl(Path::new("/a/jxl")));
    }
}
