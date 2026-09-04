import { Button, Spinner } from '@radix-ui/themes';
import { ArrowLeft, ArrowRight, Layers, Users, X } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { getBasename } from '../../common/functions';
import { useSettingsContext } from '../../components/settings/SettingsContext';
import { initialTransform, ZoomableImage, ZoomTransform } from '../../components/zoomable-image/ZoomableImage';
import { DetectFacesResult, FaceMergeError } from '../../model/model';
import { useImageRoute } from '../image/ImageRoute';
import { FaceBoxOverlay } from './FaceBoxOverlay';
import { ImageContextMenu } from '../../components/image-context-menu/ImageContextMenu';

// 'jpeg' → flat photo back into the review flow; 'ora' → layered GIMP project, opened externally
type MergeOutput = 'jpeg' | 'ora';

type MergeState =
    | { phase: 'off' }
    | { phase: 'detecting' }
    | { phase: 'selecting'; result: DetectFacesResult; selections: Record<number, string> }
    | { phase: 'merging'; result: DetectFacesResult; selections: Record<number, string>; output: MergeOutput }
    | { phase: 'error'; message: string };

function errorMessage(error: unknown): string {
    const message = (error as FaceMergeError)?.message;
    return typeof message === 'string' ? message : String(error);
}

export function ImageCompare() {
    const { markedFiles, decideMarkedFile, addMergedFile } = useImageRoute();
    const { settings } = useSettingsContext();
    const navigate = useNavigate();
    // one transform for all images: zooming/panning one zooms/pans them all
    const [transform, setTransform] = React.useState<ZoomTransform>(initialTransform);
    const [merge, setMerge] = React.useState<MergeState>({ phase: 'off' });

    React.useEffect(() => {
        if (markedFiles.length === 0) {
            navigate('/image/view', { replace: true });
        }
    }, [markedFiles, navigate]);

    if (markedFiles.length === 0) {
        return null;
    }

    const columns = Math.ceil(Math.sqrt(markedFiles.length));
    const mergeMode = merge.phase === 'selecting' || merge.phase === 'merging';

    async function startDetection() {
        setMerge({ phase: 'detecting' });
        try {
            const result = await api.detectMergeFaces(markedFiles.map((m) => m.file.path));
            // preselect the sharpest detection per person; the user only overrides the bad ones
            const selections: Record<number, string> = {};
            const bestScore: Record<number, number> = {};
            for (const face of result.faces) {
                if (bestScore[face.person_id] === undefined || face.score > bestScore[face.person_id]) {
                    bestScore[face.person_id] = face.score;
                    selections[face.person_id] = face.photo_path;
                }
            }
            setMerge({ phase: 'selecting', result, selections });
        } catch (error) {
            setMerge({ phase: 'error', message: errorMessage(error) });
        }
    }

    function selectFace(personId: number, photoPath: string) {
        setMerge((prev) =>
            prev.phase === 'selecting' ? { ...prev, selections: { ...prev.selections, [personId]: photoPath } } : prev,
        );
    }

    async function runMerge(output: MergeOutput) {
        if (merge.phase !== 'selecting') {
            return;
        }
        const { result, selections } = merge;
        setMerge({ phase: 'merging', result, selections, output });
        try {
            if (output === 'jpeg') {
                const { output_path } = await api.mergeFaces(result.session_id, selections);
                addMergedFile(output_path);
            } else {
                // layered project for manual adjustment; open it in the external editor right away
                const { output_path } = await api.mergeFacesOra(result.session_id, selections);
                await api.openFileWith(output_path, settings.externalImageEditor || undefined);
            }
            setMerge({ phase: 'off' });
        } catch (error) {
            setMerge({ phase: 'error', message: errorMessage(error) });
        }
    }

    const selectedPhotoCount = mergeMode ? new Set(Object.values(merge.selections)).size : 0;

    return (
        <div className="fixed inset-0 z-50 flex flex-col p-4">
            <div className="flex justify-between items-center pb-4">
                {merge.phase === 'off' && markedFiles.length >= 2 ? (
                    <Button variant="outline" onClick={startDetection}>
                        <Users size={16} />
                        Gesichter kombinieren
                    </Button>
                ) : merge.phase === 'detecting' ? (
                    <span className="flex items-center gap-2 text-sm">
                        <Spinner /> Gesichter werden erkannt…
                    </span>
                ) : (
                    <span></span>
                )}
                <h1 className="text-xl">Bildvergleich ({markedFiles.length})</h1>
                <Button variant="ghost" onClick={() => navigate('/image/view')}>
                    <X />
                </Button>
            </div>
            <div
                className="flex-1 min-h-0 grid gap-2 auto-rows-fr"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
                {markedFiles.map(({ file, list }) => {
                    const photo = mergeMode ? merge.result.photos.find((p) => p.path === file.path) : undefined;
                    return (
                        <div key={file.path} className="flex flex-col min-h-0 gap-1 border rounded-lg p-2">
                            <span className="text-sm text-center truncate">{getBasename(file.path)}</span>
                            <ImageContextMenu path={file.path}>
                                <div className="flex-1 min-h-0 flex">
                                    <ZoomableImage
                                        path={file.path}
                                        transform={transform}
                                        onTransformChange={setTransform}
                                        overlay={
                                            mergeMode && photo ? (
                                                <FaceBoxOverlay
                                                    faces={merge.result.faces.filter((f) => f.photo_path === file.path)}
                                                    photoSize={photo}
                                                    selections={merge.selections}
                                                    scale={transform.scale}
                                                    onSelectFace={(face) => selectFace(face.person_id, face.photo_path)}
                                                />
                                            ) : undefined
                                        }
                                    />
                                </div>
                            </ImageContextMenu>
                            {/* deciding a photo would drop it from the grid and invalidate the merge session */}
                            {!mergeMode && (
                                <div className="flex justify-center gap-2">
                                    <Button
                                        variant="outline"
                                        color="red"
                                        title={list === 'unreviewed' ? 'Bild ablehnen' : 'Bild zurück zu unbewertet'}
                                        onClick={() => decideMarkedFile(file.path, 'left')}
                                    >
                                        <ArrowLeft size={16} />
                                        {list === 'unreviewed' ? 'Ablehnen' : 'Zurücknehmen'}
                                    </Button>
                                    {list === 'unreviewed' && (
                                        <Button
                                            variant="outline"
                                            color="green"
                                            title="Bild akzeptieren"
                                            onClick={() => decideMarkedFile(file.path, 'right')}
                                        >
                                            Akzeptieren
                                            <ArrowRight size={16} />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {mergeMode && (
                <div className="flex justify-center items-center gap-4 pt-4">
                    <span className="text-sm">
                        {merge.phase === 'merging' ? (
                            <span className="flex items-center gap-2">
                                <Spinner />
                                {merge.output === 'ora' ? 'GIMP-Projekt wird erstellt…' : 'Foto wird zusammengeführt…'}
                            </span>
                        ) : (
                            `Gesichter aus ${selectedPhotoCount} ${selectedPhotoCount === 1 ? 'Foto' : 'Fotos'} ausgewählt`
                        )}
                    </span>
                    <Button
                        variant="soft"
                        color="gray"
                        disabled={merge.phase === 'merging'}
                        onClick={() => setMerge({ phase: 'off' })}
                    >
                        Abbrechen
                    </Button>
                    <Button
                        variant="outline"
                        disabled={merge.phase === 'merging' || selectedPhotoCount < 2}
                        title={
                            selectedPhotoCount < 2
                                ? 'Gesichter aus mindestens 2 verschiedenen Fotos auswählen'
                                : 'Ebenen-Projekt (.ora) zur manuellen Nachbearbeitung erstellen und öffnen'
                        }
                        onClick={() => runMerge('ora')}
                    >
                        <Layers size={16} />
                        Als Ebenen-Projekt
                    </Button>
                    <Button
                        disabled={merge.phase === 'merging' || selectedPhotoCount < 2}
                        title={
                            selectedPhotoCount < 2
                                ? 'Gesichter aus mindestens 2 verschiedenen Fotos auswählen'
                                : undefined
                        }
                        onClick={() => runMerge('jpeg')}
                    >
                        Zusammenführen
                    </Button>
                </div>
            )}
            {merge.phase === 'error' && (
                <div className="flex justify-center items-center gap-4 pt-4">
                    <span className="text-sm text-red-600">{merge.message}</span>
                    <Button variant="soft" color="gray" onClick={() => setMerge({ phase: 'off' })}>
                        Schließen
                    </Button>
                    <Button onClick={startDetection}>Erneut versuchen</Button>
                </div>
            )}
        </div>
    );
}
