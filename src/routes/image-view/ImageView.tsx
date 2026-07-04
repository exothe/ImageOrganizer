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
                <div className="flex-1 h-full flex items-center justify-center">
                    <img
                        ref={(imgRef) => {
                            if (imgRef && files.current) {
                                imgRef.src = convertFileSrc(files.current.path);
                            }
                        }}
                        style={{
                            maxHeight: '100%',
                            maxWidth: '100%',
                            objectFit: 'contain',
                        }}
                    />
                </div>
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
