import { Button } from '@radix-ui/themes';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getBasename } from '../../common/functions';
import { initialTransform, ZoomableImage, ZoomTransform } from '../../components/zoomable-image/ZoomableImage';
import { useImageRoute } from '../image/ImageRoute';

export function ImageCompare() {
    const { markedFiles, decideMarkedFile } = useImageRoute();
    const navigate = useNavigate();
    // one transform for all images: zooming/panning one zooms/pans them all
    const [transform, setTransform] = React.useState<ZoomTransform>(initialTransform);

    React.useEffect(() => {
        if (markedFiles.length === 0) {
            navigate('/image/view', { replace: true });
        }
    }, [markedFiles, navigate]);

    if (markedFiles.length === 0) {
        return null;
    }

    const columns = Math.ceil(Math.sqrt(markedFiles.length));

    return (
        <div className="fixed inset-0 z-50 flex flex-col p-4">
            <div className="flex justify-between items-center pb-4">
                <span></span>
                <h1 className="text-xl">Bildvergleich ({markedFiles.length})</h1>
                <Button variant="ghost" onClick={() => navigate('/image/view')}>
                    <X />
                </Button>
            </div>
            <div
                className="flex-1 min-h-0 grid gap-2 auto-rows-fr"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
                {markedFiles.map(({ file, list }) => (
                    <div key={file.path} className="flex flex-col min-h-0 gap-1 border rounded-lg p-2">
                        <span className="text-sm text-center truncate">{getBasename(file.path)}</span>
                        <div className="flex-1 min-h-0 flex">
                            <ZoomableImage path={file.path} transform={transform} onTransformChange={setTransform} />
                        </div>
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
                    </div>
                ))}
            </div>
        </div>
    );
}
