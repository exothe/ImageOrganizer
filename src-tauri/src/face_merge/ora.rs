// OpenRaster (.ora) export: a ZIP of layer PNGs plus stack.xml, opened natively by GIMP/Krita
// as a layered composition. Each transplanted face becomes its own layer with the feathered
// blend mask baked into the alpha channel, so the merge can be adjusted manually
// (in GIMP: Layer → Mask → Add Layer Mask → "Transfer layer's alpha channel").
// Spec: https://www.openraster.org/baseline/file-layout-spec.html

use std::fmt::Write as _;
use std::io::Write as _;
use std::path::Path;

use image::codecs::png::PngEncoder;
use image::{ExtendedColorType, ImageEncoder, RgbImage};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use super::compositing::Composite;
use super::error::FaceMergeError;

const THUMBNAIL_MAX: u32 = 256;

pub fn write_ora(path: &Path, composite: &Composite, merged: &RgbImage) -> Result<(), FaceMergeError> {
    let err = |e: &dyn std::fmt::Display| FaceMergeError::output_write(&path.to_string_lossy(), e);

    let file = std::fs::File::create(path).map_err(|e| err(&e))?;
    let mut zip = ZipWriter::new(std::io::BufWriter::new(file));
    // PNG payloads are already compressed; storing everything keeps the writer simple
    let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

    // per spec the mimetype must be the first entry, uncompressed
    zip.start_file("mimetype", stored).map_err(|e| err(&e))?;
    zip.write_all(b"image/openraster").map_err(|e| err(&e))?;

    zip.start_file("stack.xml", stored).map_err(|e| err(&e))?;
    zip.write_all(stack_xml(composite).as_bytes()).map_err(|e| err(&e))?;

    let base_png = encode_png(
        composite.base.as_raw(),
        composite.base.width(),
        composite.base.height(),
        ExtendedColorType::Rgb8,
    )
    .map_err(|e| err(&e))?;
    zip.start_file("data/layer0.png", stored).map_err(|e| err(&e))?;
    zip.write_all(&base_png).map_err(|e| err(&e))?;

    for (i, layer) in composite.layers.iter().enumerate() {
        let png = encode_png(
            layer.rgba.as_raw(),
            layer.rgba.width(),
            layer.rgba.height(),
            ExtendedColorType::Rgba8,
        )
        .map_err(|e| err(&e))?;
        zip.start_file(format!("data/layer{}.png", i + 1), stored)
            .map_err(|e| err(&e))?;
        zip.write_all(&png).map_err(|e| err(&e))?;
    }

    // spec-required flattened rendition + thumbnail (long edge ≤ 256)
    let merged_png = encode_png(merged.as_raw(), merged.width(), merged.height(), ExtendedColorType::Rgb8)
        .map_err(|e| err(&e))?;
    zip.start_file("mergedimage.png", stored).map_err(|e| err(&e))?;
    zip.write_all(&merged_png).map_err(|e| err(&e))?;

    let scale = THUMBNAIL_MAX as f32 / merged.width().max(merged.height()) as f32;
    let thumb = if scale < 1.0 {
        image::imageops::thumbnail(
            merged,
            ((merged.width() as f32 * scale) as u32).max(1),
            ((merged.height() as f32 * scale) as u32).max(1),
        )
    } else {
        merged.clone()
    };
    let thumb_png =
        encode_png(thumb.as_raw(), thumb.width(), thumb.height(), ExtendedColorType::Rgb8).map_err(|e| err(&e))?;
    zip.start_file("Thumbnails/thumbnail.png", stored).map_err(|e| err(&e))?;
    zip.write_all(&thumb_png).map_err(|e| err(&e))?;

    zip.finish().map_err(|e| err(&e))?;
    Ok(())
}

// Layer order in stack.xml is top-first: face layers above, base photo at the bottom.
fn stack_xml(composite: &Composite) -> String {
    let mut xml = String::new();
    let _ = writeln!(
        xml,
        "<?xml version='1.0' encoding='UTF-8'?>\n<image version=\"0.0.3\" w=\"{}\" h=\"{}\">\n  <stack>",
        composite.base.width(),
        composite.base.height()
    );
    for (i, layer) in composite.layers.iter().enumerate() {
        let _ = writeln!(
            xml,
            "    <layer name=\"{}\" src=\"data/layer{}.png\" x=\"{}\" y=\"{}\" opacity=\"1.0\" visibility=\"visible\" composite-op=\"svg:src-over\"/>",
            escape_xml(&layer.name),
            i + 1,
            layer.x,
            layer.y
        );
    }
    let base_name = Path::new(&composite.base_path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| composite.base_path.clone());
    let _ = writeln!(
        xml,
        "    <layer name=\"{}\" src=\"data/layer0.png\" x=\"0\" y=\"0\" opacity=\"1.0\" visibility=\"visible\" composite-op=\"svg:src-over\"/>\n  </stack>\n</image>",
        escape_xml(&format!("Basis – {}", base_name))
    );
    xml
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn encode_png(raw: &[u8], width: u32, height: u32, color: ExtendedColorType) -> Result<Vec<u8>, image::ImageError> {
    let mut buf = Vec::new();
    PngEncoder::new(&mut buf).write_image(raw, width, height, color)?;
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::super::compositing::FaceLayer;
    use super::*;
    use std::io::Read;

    #[test]
    fn writes_valid_ora_structure() {
        let base = RgbImage::from_pixel(8, 6, image::Rgb([10, 20, 30]));
        let mut rgba = image::RgbaImage::new(4, 3);
        rgba.put_pixel(1, 1, image::Rgba([200, 100, 50, 255]));
        let composite = Composite {
            base_path: "/tmp/photo & \"test\".jpg".to_owned(),
            base: base.clone(),
            layers: vec![FaceLayer {
                name: "Person 1 – <b>.jpg".to_owned(),
                x: 2,
                y: 1,
                rgba,
            }],
        };
        let dir = std::env::temp_dir().join("face_merge_ora_test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("out.ora");
        let _ = std::fs::remove_file(&path);

        write_ora(&path, &composite, &base).unwrap();

        let file = std::fs::File::open(&path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();

        // mimetype must be the first, uncompressed entry
        {
            let mut first = archive.by_index(0).unwrap();
            assert_eq!(first.name(), "mimetype");
            assert_eq!(first.compression(), CompressionMethod::Stored);
            let mut mime = String::new();
            first.read_to_string(&mut mime).unwrap();
            assert_eq!(mime, "image/openraster");
        }

        let mut xml = String::new();
        archive.by_name("stack.xml").unwrap().read_to_string(&mut xml).unwrap();
        assert!(xml.contains("w=\"8\" h=\"6\""), "{}", xml);
        assert!(xml.contains("Person 1 – &lt;b&gt;.jpg"), "{}", xml);
        assert!(xml.contains("x=\"2\" y=\"1\""), "{}", xml);
        // face layer above base: layer1 listed before layer0
        assert!(xml.find("data/layer1.png").unwrap() < xml.find("data/layer0.png").unwrap());

        for name in ["data/layer0.png", "data/layer1.png", "mergedimage.png", "Thumbnails/thumbnail.png"] {
            let mut bytes = Vec::new();
            archive.by_name(name).unwrap().read_to_end(&mut bytes).unwrap();
            image::load_from_memory(&bytes).unwrap_or_else(|e| panic!("{} not a decodable PNG: {}", name, e));
        }
    }
}
