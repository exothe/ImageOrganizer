use nalgebra::{Matrix3, Vector3};

use super::detection::RawFace;
use super::{DetectedFace, FaceBox, PhotoInfo};

// People move between shots (the photos can be seconds apart), so faces of the same person
// don't necessarily overlap after alignment. Match by center distance relative to face size
// instead of IoU: allow up to this factor times the larger face dimension.
const MAX_CENTER_DISTANCE_FACTOR: f64 = 1.2;
// faces of very different size are different people (foreground vs background)
const MAX_SIZE_RATIO: f64 = 2.0;

// Face box mapped into the reference frame (axis-aligned bounding box of the warped corners).
fn to_ref_frame(face: &RawFace, h: &Matrix3<f64>) -> [f64; 4] {
    let corners = [
        (face.x, face.y),
        (face.x + face.width, face.y),
        (face.x, face.y + face.height),
        (face.x + face.width, face.y + face.height),
    ];
    let (mut min_x, mut min_y) = (f64::INFINITY, f64::INFINITY);
    let (mut max_x, mut max_y) = (f64::NEG_INFINITY, f64::NEG_INFINITY);
    for (x, y) in corners {
        let p = h * Vector3::new(x as f64, y as f64, 1.0);
        let (px, py) = (p.x / p.z, p.y / p.z);
        min_x = min_x.min(px);
        min_y = min_y.min(py);
        max_x = max_x.max(px);
        max_y = max_y.max(py);
    }
    [min_x, min_y, max_x, max_y]
}

struct RefFace {
    photo_idx: usize,
    face: RawFace,
    center: (f64, f64),
    size: f64, // larger dimension in the reference frame
}

struct Cluster {
    person_id: u32,
    // running state of the last assigned face; new photos match against this
    center: (f64, f64),
    size: f64,
    photos: Vec<usize>,
}

fn matching_cost(cluster: &Cluster, face: &RefFace) -> Option<f64> {
    let ratio = cluster.size.max(face.size) / cluster.size.min(face.size).max(1e-9);
    if ratio > MAX_SIZE_RATIO {
        return None;
    }
    let distance =
        ((cluster.center.0 - face.center.0).powi(2) + (cluster.center.1 - face.center.1).powi(2)).sqrt();
    let limit = MAX_CENTER_DISTANCE_FACTOR * cluster.size.max(face.size);
    (distance <= limit).then_some(distance)
}

// Groups faces of the same person across aligned photos. Photo by photo, each face is greedily
// matched one-to-one to the nearest existing cluster (by center distance in the reference frame);
// unmatched faces start new clusters. Faces seen in only one photo stay selectable as singletons.
pub fn cluster_faces(
    photos: &[PhotoInfo],
    faces_per_photo: &[Vec<RawFace>],
    homographies_to_ref: &[Matrix3<f64>],
) -> Vec<DetectedFace> {
    let mut clusters: Vec<Cluster> = Vec::new();
    let mut result = Vec::new();

    for (photo_idx, faces) in faces_per_photo.iter().enumerate() {
        let ref_faces: Vec<RefFace> = faces
            .iter()
            .map(|f| {
                let b = to_ref_frame(f, &homographies_to_ref[photo_idx]);
                RefFace {
                    photo_idx,
                    face: *f,
                    center: ((b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0),
                    size: (b[2] - b[0]).max(b[3] - b[1]),
                }
            })
            .collect();

        // all valid (cluster, face) pairs, cheapest distance first
        let mut candidates: Vec<(f64, usize, usize)> = Vec::new();
        for (ci, cluster) in clusters.iter().enumerate() {
            if cluster.photos.contains(&photo_idx) {
                continue;
            }
            for (fi, face) in ref_faces.iter().enumerate() {
                if let Some(cost) = matching_cost(cluster, face) {
                    candidates.push((cost, ci, fi));
                }
            }
        }
        candidates.sort_by(|a, b| a.0.total_cmp(&b.0));

        // greedy one-to-one assignment: a cluster takes at most one face per photo
        let mut face_cluster: Vec<Option<usize>> = vec![None; ref_faces.len()];
        let mut cluster_taken: Vec<bool> = vec![false; clusters.len()];
        for (_, ci, fi) in candidates {
            if face_cluster[fi].is_none() && !cluster_taken[ci] {
                face_cluster[fi] = Some(ci);
                cluster_taken[ci] = true;
            }
        }

        for (fi, ref_face) in ref_faces.into_iter().enumerate() {
            let cluster_idx = match face_cluster[fi] {
                Some(ci) => {
                    let cluster = &mut clusters[ci];
                    cluster.center = ref_face.center;
                    cluster.size = ref_face.size;
                    cluster.photos.push(photo_idx);
                    ci
                }
                None => {
                    clusters.push(Cluster {
                        person_id: clusters.len() as u32,
                        center: ref_face.center,
                        size: ref_face.size,
                        photos: vec![photo_idx],
                    });
                    clusters.len() - 1
                }
            };
            result.push(DetectedFace {
                photo_path: photos[ref_face.photo_idx].path.clone(),
                person_id: clusters[cluster_idx].person_id,
                face_box: FaceBox {
                    x: ref_face.face.x,
                    y: ref_face.face.y,
                    width: ref_face.face.width,
                    height: ref_face.face.height,
                },
                score: ref_face.face.score,
            });
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn photo(path: &str) -> PhotoInfo {
        PhotoInfo {
            path: path.into(),
            width: 4000,
            height: 3000,
        }
    }

    fn face(x: f32, y: f32, size: f32) -> RawFace {
        RawFace {
            x,
            y,
            width: size,
            height: size * 1.4,
            score: 0.9,
        }
    }

    #[test]
    fn moved_person_stays_one_cluster() {
        let photos = [photo("a.jpg"), photo("b.jpg")];
        // person shifted by a full face width between shots — no box overlap
        let faces = [vec![face(1000.0, 800.0, 150.0)], vec![face(1160.0, 830.0, 150.0)]];
        let hs = [Matrix3::identity(), Matrix3::identity()];
        let result = cluster_faces(&photos, &faces, &hs);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].person_id, result[1].person_id);
    }

    #[test]
    fn neighbours_stay_separate() {
        let photos = [photo("a.jpg"), photo("b.jpg")];
        // two people standing next to each other in both shots
        let faces = [
            vec![face(1000.0, 800.0, 150.0), face(1500.0, 820.0, 150.0)],
            vec![face(1030.0, 810.0, 150.0), face(1520.0, 800.0, 150.0)],
        ];
        let hs = [Matrix3::identity(), Matrix3::identity()];
        let result = cluster_faces(&photos, &faces, &hs);
        let ids: Vec<u32> = result.iter().map(|f| f.person_id).collect();
        assert_eq!(ids, vec![0, 1, 0, 1]);
    }

    #[test]
    fn far_face_stays_singleton() {
        let photos = [photo("a.jpg"), photo("b.jpg")];
        let faces = [vec![face(1000.0, 800.0, 150.0)], vec![face(2500.0, 900.0, 150.0)]];
        let hs = [Matrix3::identity(), Matrix3::identity()];
        let result = cluster_faces(&photos, &faces, &hs);
        assert_ne!(result[0].person_id, result[1].person_id);
    }

    #[test]
    fn different_sizes_stay_separate() {
        let photos = [photo("a.jpg"), photo("b.jpg")];
        // background person's face near the foreground person's position, but much smaller
        let faces = [vec![face(1000.0, 800.0, 150.0)], vec![face(1050.0, 820.0, 50.0)]];
        let hs = [Matrix3::identity(), Matrix3::identity()];
        let result = cluster_faces(&photos, &faces, &hs);
        assert_ne!(result[0].person_id, result[1].person_id);
    }
}
