import { Button } from '@radix-ui/themes';
import { useFileListFocusContext } from '../../components/file-list/fileListFocusContext';
import { X } from 'lucide-react';
import { getBasename } from '../../common/functions';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useSettingsContext } from '../../components/settings/SettingsContext';
import { Switch } from '../../components/switch/Switch';
import { cn } from '../../components/utils';
import { useNavigate } from 'react-router-dom';
import React from 'react';

const MIN_SCALE = 1;
const MAX_SCALE = 10;

interface ZoomTransform {
    scale: number;
    x: number;
    y: number;
}

const initialTransform: ZoomTransform = { scale: 1, x: 0, y: 0 };

function ZoomableImage({ path }: { path: string }) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [transform, setTransform] = React.useState<ZoomTransform>(initialTransform);
    const transformRef = React.useRef(transform);
    transformRef.current = transform;
    const gestureStartScale = React.useRef(1);
    const dragStart = React.useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);

    React.useEffect(() => {
        setTransform(initialTransform);
    }, [path]);

    const zoomTo = React.useCallback((targetScale: number, clientX: number, clientY: number) => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const rect = container.getBoundingClientRect();
        setTransform((prev) => {
            const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
            if (scale === 1) {
                return initialTransform;
            }
            // cursor position relative to container center (= transform origin)
            const cx = clientX - rect.left - rect.width / 2;
            const cy = clientY - rect.top - rect.height / 2;
            const ratio = scale / prev.scale;
            return { scale, x: cx - (cx - prev.x) * ratio, y: cy - (cy - prev.y) * ratio };
        });
    }, []);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        // native listeners: React attaches wheel as passive, preventDefault would be ignored
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            // ctrlKey is set for pinch gestures translated to wheel events
            const sensitivity = event.ctrlKey ? 0.01 : 0.002;
            const factor = Math.exp(-event.deltaY * sensitivity);
            zoomTo(transformRef.current.scale * factor, event.clientX, event.clientY);
        };

        // WKWebView (macOS) delivers trackpad pinch as non-standard gesture events
        const onGestureStart = (event: Event) => {
            event.preventDefault();
            gestureStartScale.current = transformRef.current.scale;
        };
        const onGestureChange = (event: Event) => {
            event.preventDefault();
            const gesture = event as Event & { scale: number; clientX: number; clientY: number };
            zoomTo(gestureStartScale.current * gesture.scale, gesture.clientX, gesture.clientY);
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        container.addEventListener('gesturestart', onGestureStart);
        container.addEventListener('gesturechange', onGestureChange);
        return () => {
            container.removeEventListener('wheel', onWheel);
            container.removeEventListener('gesturestart', onGestureStart);
            container.removeEventListener('gesturechange', onGestureChange);
        };
    }, [zoomTo]);

    const onPointerDown = (event: React.PointerEvent) => {
        if (transformRef.current.scale === 1) {
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStart.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            x: transformRef.current.x,
            y: transformRef.current.y,
        };
    };

    const onPointerMove = (event: React.PointerEvent) => {
        const start = dragStart.current;
        if (!start) {
            return;
        }
        setTransform((prev) => ({
            ...prev,
            x: start.x + event.clientX - start.pointerX,
            y: start.y + event.clientY - start.pointerY,
        }));
    };

    const onPointerUp = () => {
        dragStart.current = null;
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                'flex-1 h-full flex items-center justify-center overflow-hidden',
                transform.scale > 1 && 'cursor-grab',
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => setTransform(initialTransform)}
        >
            <img
                src={convertFileSrc(path)}
                draggable={false}
                style={{
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: 'center',
                    // own compositing layer — without it WKWebView repaints on every pan step and
                    // leaves stale-pixel artifacts behind the image
                    willChange: 'transform',
                }}
            />
        </div>
    );
}

export function ImageView() {
    const { files } = useFileListFocusContext();
    const { settings, setSettings } = useSettingsContext();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (files.current === null) {
            navigate('/image/list', { replace: true });
        }
    }, [files, navigate]);

    if (files.current === null) {
        return <div>Es gibt kein Bild mehr, was angezeigt werden könnte.</div>;
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col p-4">
            <div className="flex justify-between pb-4">
                <span></span>
                <h1 className="text-xl">{getBasename(files.current.path)}</h1>
                <div className="flex gap-2 items-center">
                    <label className="p-2 h-8 flex gap-2 items-center text-sm border rounded-lg">
                        <span className={cn(settings.showNeighbooringPictures && 'opacity-25')}>ohne Vorschau</span>
                        <Switch
                            checked={settings.showNeighbooringPictures}
                            onCheckedChange={(checked) =>
                                setSettings((settings) => ({
                                    ...settings,
                                    showNeighbooringPictures: checked,
                                }))
                            }
                        />
                        <span className={cn(!settings.showNeighbooringPictures && 'opacity-25')}>mit Vorschau</span>
                    </label>
                    <Button variant="ghost" onClick={() => navigate('/image/list')}>
                        <X />
                    </Button>
                </div>
            </div>
            <div className="flex flex-1 min-h-0 justify-center items-center gap-2 px-2">
                {settings.showNeighbooringPictures && files.previous && (
                    <div className="h-[12vh] w-[12vw] flex items-center justify-center">
                        <img
                            ref={(imgRef) => {
                                if (imgRef && files.previous) {
                                    imgRef.src = convertFileSrc(files.previous.path);
                                }
                            }}
                            style={{
                                maxHeight: '100%',
                                maxWidth: '100%',
                                objectFit: 'contain',
                            }}
                        />
                    </div>
                )}
                <ZoomableImage path={files.current.path} />
                {settings.showNeighbooringPictures && files.next && (
                    <div className="h-[12vh] w-[12vw] flex items-center justify-center">
                        <img
                            ref={(imgRef) => {
                                if (imgRef && files.next) {
                                    imgRef.src = convertFileSrc(files.next.path);
                                }
                            }}
                            style={{
                                maxHeight: '100%',
                                maxWidth: '100%',
                                objectFit: 'contain',
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
