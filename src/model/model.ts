export type SaveImageResult = {
    successfully_saved_files: string[];
    errors: Record<string, string>;
    global_errors: string[];
    renamed_files: Record<string, string>;
};

export type RemoveFileResult = {
    success: boolean;
    failed_files: string[];
};

export type FaceBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type DetectedFace = {
    photo_path: string;
    person_id: number;
    face_box: FaceBox;
    score: number;
};

export type PhotoInfo = {
    path: string;
    width: number;
    height: number;
};

export type DetectFacesResult = {
    session_id: number;
    photos: PhotoInfo[];
    faces: DetectedFace[];
    alignment_inliers: number[];
};

export type MergeFacesResult = {
    output_path: string;
};

// rejection value of the face-merge commands
export type FaceMergeError = {
    code: string;
    message: string;
};
