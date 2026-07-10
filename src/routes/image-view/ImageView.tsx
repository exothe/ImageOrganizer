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
import { useImageRoute } from '../image/ImageRoute';

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

const PREVIEW_HEIGHT = 96;
const PREVIEW_GAP = 8;

function PreviewStrip() {
    const { fileListId, selectedIndex } = useFileListFocusContext();
    const { unreviewedFiles, filteredAcceptedFiles, select } = useImageRoute();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = React.useState(0);

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const observer = new ResizeObserver(([entry]) => {
            const height = entry.contentRect.height;
            setVisibleCount(Math.max(1, Math.floor((height + PREVIEW_GAP) / (PREVIEW_HEIGHT + PREVIEW_GAP))));
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const list = fileListId === 'unreviewedFiles' ? unreviewedFiles : filteredAcceptedFiles;

    let previews: { file: { path: string }; index: number }[] = [];
    if (selectedIndex !== null && visibleCount > 0) {
        const start = Math.max(
            0,
            Math.min(selectedIndex - Math.floor((visibleCount - 1) / 2), list.length - visibleCount),
        );
        previews = list.slice(start, start + visibleCount).map((file, i) => ({ file, index: start + i }));
    }

    return (
        <div ref={containerRef} className="h-full w-[12vw] flex flex-col items-center justify-center gap-2">
            {previews.map(({ file, index }) => (
                <button
                    key={file.path}
                    onClick={() => select(fileListId, index)}
                    className={cn(
                        'w-full flex items-center justify-center rounded p-1',
                        index === selectedIndex && 'ring-2 ring-primary',
                    )}
                    style={{ height: PREVIEW_HEIGHT }}
                >
                    <img
                        src={convertFileSrc(file.path)}
                        draggable={false}
                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                    />
                </button>
            ))}
        </div>
    );
}

export function ImageView() {
    const { files, fileListId } = useFileListFocusContext();
    const { settings, setSettings } = useSettingsContext();
    const navigate = useNavigate();
    const [swipeGhost, setSwipeGhost] = React.useState<{ path: string; direction: 'left' | 'right' } | null>(null);

    // needed in useEffect. If we use state there directly, we would need to add it to deps. This would reinitialize the
    // event listener on every keypress
    const currentPathRef = React.useRef<string | null>(null);
    currentPathRef.current = files.current?.path ?? null;

    React.useEffect(() => {
        if (files.current === null) {
            navigate('/image/list', { replace: true });
        }
    }, [files, navigate]);

    // Mirrors the accept/reject shortcuts in ImageRoute: show the outgoing image tilting away and fading out.
    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const path = currentPathRef.current;
            if (path === null) {
                return;
            }
            if (event.key === 'ArrowLeft') {
                setSwipeGhost({ path, direction: 'left' });
            } else if (event.key === 'ArrowRight' && fileListId === 'unreviewedFiles') {
                setSwipeGhost({ path, direction: 'right' });
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [fileListId]);

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
                {settings.showNeighbooringPictures && <PreviewStrip />}
                <div className="relative flex-1 h-full flex">
                    <ZoomableImage path={files.current.path} />
                    {swipeGhost && (
                        <div
                            key={swipeGhost.path}
                            className={cn(
                                'absolute inset-0 flex items-center justify-center pointer-events-none',
                                swipeGhost.direction === 'left' ? 'animate-swipe-out-left' : 'animate-swipe-out-right',
                            )}
                            onAnimationEnd={() => setSwipeGhost(null)}
                        >
                            <img
                                src={convertFileSrc(swipeGhost.path)}
                                draggable={false}
                                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
