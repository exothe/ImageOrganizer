import { convertFileSrc } from '@tauri-apps/api/core';
import React from 'react';
import { cn } from '../utils';

const MIN_SCALE = 1;
const MAX_SCALE = 10;

export interface ZoomTransform {
    scale: number;
    x: number;
    y: number;
}

export const initialTransform: ZoomTransform = { scale: 1, x: 0, y: 0 };

interface ZoomableImageProps {
    path: string;
    // controlled mode: several images share one transform (e.g. comparison view)
    transform?: ZoomTransform;
    onTransformChange?: React.Dispatch<React.SetStateAction<ZoomTransform>>;
}

export function ZoomableImage({ path, transform: controlledTransform, onTransformChange }: ZoomableImageProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [internalTransform, setInternalTransform] = React.useState<ZoomTransform>(initialTransform);
    const controlled = controlledTransform !== undefined && onTransformChange !== undefined;
    const transform = controlled ? controlledTransform : internalTransform;
    const setTransform = controlled ? onTransformChange : setInternalTransform;
    const transformRef = React.useRef(transform);
    transformRef.current = transform;
    const gestureStartScale = React.useRef(1);
    const dragStart = React.useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);

    React.useEffect(() => {
        if (!controlled) {
            setInternalTransform(initialTransform);
        }
    }, [path, controlled]);

    const zoomTo = React.useCallback(
        (targetScale: number, clientX: number, clientY: number) => {
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
        },
        [setTransform],
    );

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
