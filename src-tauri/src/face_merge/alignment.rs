use arrsac::Arrsac;
use image::{GrayImage, RgbImage};
use imageproc::binary_descriptors::brief::{brief, BriefDescriptor, TestPair};
use imageproc::binary_descriptors::{match_binary_descriptors, BinaryDescriptor};
use imageproc::corners::corners_fast9;
use imageproc::point::Point;
use nalgebra::{DMatrix, Matrix3, Vector3};
use rand::SeedableRng;
use sample_consensus::{Consensus, Estimator, Model};

use super::image_io;

const FAST_THRESHOLD: u8 = 20;
const MAX_KEYPOINTS: usize = 4000;
// BRIEF tests use a 31x31 patch plus 5px sub-patch averaging — keep keypoints away from borders
const BORDER_MARGIN: u32 = 24;
const DESCRIPTOR_BITS: usize = 256;
// max Hamming distance for a descriptor match (25% of DESCRIPTOR_BITS)
const MATCH_THRESHOLD: u32 = 64;
const MIN_MATCHES: usize = 20;
const MIN_INLIERS: usize = 30;
const MIN_INLIER_RATIO: f64 = 0.2;
const RANSAC_INLIER_THRESHOLD: f64 = 3.0; // px, at working resolution

type FeatureMatch = ([f64; 2], [f64; 2]); // (from, to)

pub struct HomographyModel {
    h: Matrix3<f64>,
    h_inv: Matrix3<f64>,
}

fn project(h: &Matrix3<f64>, p: &[f64; 2]) -> Option<[f64; 2]> {
    let q = h * Vector3::new(p[0], p[1], 1.0);
    if q.z.abs() < 1e-12 {
        return None;
    }
    Some([q.x / q.z, q.y / q.z])
}

impl Model<FeatureMatch> for HomographyModel {
    fn residual(&self, data: &FeatureMatch) -> f64 {
        let (from, to) = data;
        let forward = project(&self.h, from);
        let backward = project(&self.h_inv, to);
        match (forward, backward) {
            (Some(f), Some(b)) => {
                let e1 = ((f[0] - to[0]).powi(2) + (f[1] - to[1]).powi(2)).sqrt();
                let e2 = ((b[0] - from[0]).powi(2) + (b[1] - from[1]).powi(2)).sqrt();
                (e1 + e2) / 2.0
            }
            _ => f64::INFINITY,
        }
    }
}

pub struct HomographyEstimator;

impl Estimator<FeatureMatch> for HomographyEstimator {
    type Model = HomographyModel;
    type ModelIter = Option<HomographyModel>;
    const MIN_SAMPLES: usize = 4;

    fn estimate<I>(&self, data: I) -> Self::ModelIter
    where
        I: Iterator<Item = FeatureMatch> + Clone,
    {
        let matches: Vec<FeatureMatch> = data.collect();
        let h = dlt_homography(&matches)?;
        let h_inv = h.try_inverse()?;
        Some(HomographyModel { h, h_inv })
    }
}

// Similarity normalization (Hartley): translate centroid to origin, scale avg distance to sqrt(2).
fn normalization(points: &[[f64; 2]]) -> Matrix3<f64> {
    let n = points.len() as f64;
    let cx = points.iter().map(|p| p[0]).sum::<f64>() / n;
    let cy = points.iter().map(|p| p[1]).sum::<f64>() / n;
    let avg_dist = points
        .iter()
        .map(|p| ((p[0] - cx).powi(2) + (p[1] - cy).powi(2)).sqrt())
        .sum::<f64>()
        / n;
    let s = if avg_dist > 1e-12 { 2f64.sqrt() / avg_dist } else { 1.0 };
    Matrix3::new(s, 0.0, -s * cx, 0.0, s, -s * cy, 0.0, 0.0, 1.0)
}

// Direct linear transform from >= 4 correspondences. Returns H mapping from -> to.
fn dlt_homography(matches: &[FeatureMatch]) -> Option<Matrix3<f64>> {
    if matches.len() < 4 {
        return None;
    }
    let from: Vec<[f64; 2]> = matches.iter().map(|m| m.0).collect();
    let to: Vec<[f64; 2]> = matches.iter().map(|m| m.1).collect();
    let t_from = normalization(&from);
    let t_to = normalization(&to);

    let mut a = DMatrix::<f64>::zeros(matches.len() * 2, 9);
    for (i, (p, q)) in from.iter().zip(to.iter()).enumerate() {
        let p = project(&t_from, p)?;
        let q = project(&t_to, q)?;
        let (x, y) = (p[0], p[1]);
        let (u, v) = (q[0], q[1]);
        let r = i * 2;
        a[(r, 0)] = -x;
        a[(r, 1)] = -y;
        a[(r, 2)] = -1.0;
        a[(r, 6)] = u * x;
        a[(r, 7)] = u * y;
        a[(r, 8)] = u;
        a[(r + 1, 3)] = -x;
        a[(r + 1, 4)] = -y;
        a[(r + 1, 5)] = -1.0;
        a[(r + 1, 6)] = v * x;
        a[(r + 1, 7)] = v * y;
        a[(r + 1, 8)] = v;
    }

    // null vector of A = eigenvector of A^T A for the smallest eigenvalue
    // (nalgebra's thin SVD of the 2Nx9 system omits the 9th right singular vector)
    let ata = a.transpose() * &a;
    let eigen = nalgebra::SymmetricEigen::new(ata);
    let min_idx = eigen
        .eigenvalues
        .iter()
        .enumerate()
        .min_by(|(_, x), (_, y)| x.total_cmp(y))
        .map(|(i, _)| i)?;
    let h_vec = eigen.eigenvectors.column(min_idx);
    let h_norm = Matrix3::new(
        h_vec[0], h_vec[1], h_vec[2], h_vec[3], h_vec[4], h_vec[5], h_vec[6], h_vec[7], h_vec[8],
    );
    // denormalize: H = T_to^-1 * Hn * T_from
    let h = t_to.try_inverse()? * h_norm * t_from;
    if h[(2, 2)].abs() < 1e-12 {
        return None;
    }
    Some(h / h[(2, 2)])
}

// FAST corners, strongest first, capped and kept clear of the image border.
fn keypoints(gray: &GrayImage) -> Vec<Point<u32>> {
    let (w, h) = (gray.width(), gray.height());
    if w <= 2 * BORDER_MARGIN || h <= 2 * BORDER_MARGIN {
        return Vec::new();
    }
    let mut corners = corners_fast9(gray, FAST_THRESHOLD);
    corners.retain(|c| {
        c.x >= BORDER_MARGIN && c.y >= BORDER_MARGIN && c.x < w - BORDER_MARGIN && c.y < h - BORDER_MARGIN
    });
    corners.sort_by(|a, b| b.score.total_cmp(&a.score));
    corners.truncate(MAX_KEYPOINTS);
    corners.into_iter().map(|c| Point::new(c.x, c.y)).collect()
}

fn descriptors(
    gray: &GrayImage,
    test_pairs: Option<&Vec<TestPair>>,
) -> Option<(Vec<BriefDescriptor>, Vec<TestPair>)> {
    let points = keypoints(gray);
    if points.is_empty() {
        return None;
    }
    brief(gray, &points, DESCRIPTOR_BITS, test_pairs).ok()
}

// Estimates the homography mapping `from` coordinates into `to` coordinates
// (both at working resolution). Returns None if the photos can't be aligned.
pub fn align(from: &RgbImage, to: &RgbImage) -> Option<(Matrix3<f64>, u32)> {
    let gray_from = image_io::to_gray(from);
    let gray_to = image_io::to_gray(to);
    // both images must use the same BRIEF test pairs for distances to be meaningful
    let (desc_from, test_pairs) = descriptors(&gray_from, None)?;
    let (desc_to, _) = descriptors(&gray_to, Some(&test_pairs))?;

    let matches: Vec<FeatureMatch> = match_binary_descriptors(&desc_from, &desc_to, MATCH_THRESHOLD, Some(42))
        .into_iter()
        .map(|(a, b)| {
            let p = a.position();
            let q = b.position();
            ([p.x as f64, p.y as f64], [q.x as f64, q.y as f64])
        })
        .collect();
    if matches.len() < MIN_MATCHES {
        return None;
    }

    // fixed seed: deterministic results for identical inputs
    let rng = rand::rngs::StdRng::seed_from_u64(42);
    let mut arrsac = Arrsac::new(RANSAC_INLIER_THRESHOLD, rng);
    let (model, inliers) = arrsac.model_inliers(&HomographyEstimator, matches.iter().copied())?;
    let inlier_count = inliers.into_iter().count();
    if inlier_count < MIN_INLIERS || (inlier_count as f64) < MIN_INLIER_RATIO * matches.len() as f64 {
        return None;
    }
    Some((model.h, inlier_count as u32))
}

#[cfg(test)]
mod tests {
    use super::*;
    use imageproc::geometric_transformations::{warp, Border, Interpolation, Projection};

    // deterministic textured image so FAST finds plenty of corners
    pub(super) fn textured_image(w: u32, h: u32) -> RgbImage {
        let mut img = RgbImage::from_pixel(w, h, image::Rgb([200, 200, 200]));
        let mut state = 0x12345678u64;
        let mut next = move || {
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (state >> 33) as u32
        };
        for _ in 0..400 {
            let (cx, cy) = (next() % w, next() % h);
            let size = 3 + next() % 12;
            let shade = (next() % 180) as u8;
            for dy in 0..size {
                for dx in 0..size {
                    let (x, y) = (cx + dx, cy + dy);
                    if x < w && y < h {
                        img.put_pixel(x, y, image::Rgb([shade, shade, shade]));
                    }
                }
            }
        }
        img
    }

    #[test]
    fn align_recovers_translation() {
        let original = textured_image(800, 600);
        let projection = Projection::translate(15.0, 10.0);
        let shifted = warp(
            &original,
            projection,
            Interpolation::Bilinear,
            Border::Constant(image::Rgb([200, 200, 200])),
        );

        let (h, inliers) = align(&original, &shifted).expect("images must align");
        assert!(inliers >= MIN_INLIERS as u32);
        assert!((h[(0, 2)] - 15.0).abs() < 1.0, "tx: {}", h[(0, 2)]);
        assert!((h[(1, 2)] - 10.0).abs() < 1.0, "ty: {}", h[(1, 2)]);
        assert!((h[(0, 0)] - 1.0).abs() < 0.01);
        assert!((h[(1, 1)] - 1.0).abs() < 0.01);
    }

    #[test]
    fn align_rejects_unrelated_images() {
        let a = textured_image(800, 600);
        let blank = RgbImage::from_pixel(800, 600, image::Rgb([230, 230, 230]));
        assert!(align(&a, &blank).is_none());
    }
}

