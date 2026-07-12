import { Check } from 'lucide-react';
import { DetectedFace } from '../../model/model';

// one fixed color per person, consistent across all photos
const PERSON_COLORS = ['#3e63dd', '#30a46c', '#f76b15', '#8e4ec6', '#00a2c7', '#d6409f', '#ffc53d', '#12a594'];

interface FaceBoxOverlayProps {
    // faces of the photo this overlay sits on
    faces: DetectedFace[];
    // oriented dimensions of the photo, as reported by the backend
    photoSize: { width: number; height: number };
    // person_id -> selected photo path
    selections: Record<number, string>;
    // current zoom scale, to keep border widths constant on screen
    scale: number;
    onSelectFace: (face: DetectedFace) => void;
}

export function FaceBoxOverlay({ faces, photoSize, selections, scale, onSelectFace }: FaceBoxOverlayProps) {
    return (
        <>
            {faces.map((face) => {
                const color = PERSON_COLORS[face.person_id % PERSON_COLORS.length];
                const selected = selections[face.person_id] === face.photo_path;
                return (
                    <div
                        key={`${face.person_id}-${face.face_box.x}`}
                        title={`Person ${face.person_id + 1}`}
                        style={{
                            position: 'absolute',
                            left: `${(face.face_box.x / photoSize.width) * 100}%`,
                            top: `${(face.face_box.y / photoSize.height) * 100}%`,
                            width: `${(face.face_box.width / photoSize.width) * 100}%`,
                            height: `${(face.face_box.height / photoSize.height) * 100}%`,
                            border: selected ? `${3 / scale}px solid ${color}` : `${2 / scale}px dashed ${color}`,
                            backgroundColor: selected ? `${color}33` : 'transparent',
                            borderRadius: 4 / scale,
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                        }}
                        // a click on a face must never start the pan-drag in ZoomableImage
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onSelectFace(face)}
                    >
                        {selected && (
                            <Check
                                style={{
                                    position: 'absolute',
                                    top: 2 / scale,
                                    right: 2 / scale,
                                    width: 16 / scale,
                                    height: 16 / scale,
                                    color: 'white',
                                    backgroundColor: color,
                                    borderRadius: '50%',
                                    padding: 2 / scale,
                                }}
                            />
                        )}
                    </div>
                );
            })}
        </>
    );
}
