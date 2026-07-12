import { Button } from '@radix-ui/themes';
import { useFileListFocusContext } from '../../components/file-list/fileListFocusContext';
import { Columns2, X } from 'lucide-react';
import { getBasename } from '../../common/functions';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useSettingsContext } from '../../components/settings/SettingsContext';
import { Switch } from '../../components/switch/Switch';
import { ZoomableImage } from '../../components/zoomable-image/ZoomableImage';
import { cn } from '../../components/utils';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import { useImageRoute } from '../image/ImageRoute';
import { ImageContextMenu } from '../../components/image-context-menu/ImageContextMenu';

const PREVIEW_HEIGHT = 96;
const PREVIEW_GAP = 8;

function PreviewStrip() {
    const { fileListId, selectedIndex } = useFileListFocusContext();
    const { unreviewedFiles, filteredAcceptedFiles, select, markedPaths } = useImageRoute();
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
                <ImageContextMenu key={file.path} path={file.path}>
                    <button
                        onClick={() => select(fileListId, index)}
                        className={cn(
                            'w-full flex items-center justify-center rounded p-1',
                            markedPaths.includes(file.path) && 'bg-gray-300',
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
                </ImageContextMenu>
            ))}
        </div>
    );
}

export function ImageView() {
    const { files, fileListId } = useFileListFocusContext();
    const { settings, setSettings } = useSettingsContext();
    const { markedPaths } = useImageRoute();
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
                    {markedPaths.length > 0 && (
                        <Button variant="outline" onClick={() => navigate('/image/compare')}>
                            <Columns2 size={16} /> Vergleichen ({markedPaths.length})
                        </Button>
                    )}
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
                <ImageContextMenu path={files.current.path}>
                    <div className="relative flex-1 h-full flex">
                        <ZoomableImage path={files.current.path} />
                        {swipeGhost && (
                            <div
                                key={swipeGhost.path}
                                className={cn(
                                    'absolute inset-0 flex items-center justify-center pointer-events-none',
                                    swipeGhost.direction === 'left'
                                        ? 'animate-swipe-out-left'
                                        : 'animate-swipe-out-right',
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
                </ImageContextMenu>
            </div>
        </div>
    );
}
