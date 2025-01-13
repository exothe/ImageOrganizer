import { Button, Dialog } from '@radix-ui/themes';
import { useImageDialogContext } from './imageDialogContext';
import { useFileListFocusContext } from './fileListFocusContext';
import { X } from 'lucide-react';
import { getBasename } from '../../common/functions';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useSettingsContext } from '../settings/SettingsContext';
import { Switch } from '../switch/Switch';
import { cn } from '../utils';

export function ImageDialog() {
    const { open, setOpen } = useImageDialogContext();
    const { files } = useFileListFocusContext();
    const { settings, setSettings } = useSettingsContext();

    return (
        <Dialog.Root open={open && files.current !== null}>
            <Dialog.Content
                style={{
                    position: 'absolute',
                    top: '1rem',
                    left: '1rem',
                    right: '1rem',
                    bottom: '1rem',
                    maxWidth: '95%',
                    maxHeight: '100%',
                    borderRadius: 0,
                }}
            >
                {files.current !== null && (
                    <>
                        <div className="flex justify-between pb-4">
                            <span></span>
                            <Dialog.Title className="text-xl">{getBasename(files.current.path)}</Dialog.Title>
                            <div className="flex gap-2 items-center">
                                <label className="p-2 h-8 flex gap-2 items-center text-sm border rounded-lg">
                                    <span className={cn(settings.showNeighbooringPictures && 'opacity-25')}>
                                        ohne Vorschau
                                    </span>
                                    <Switch
                                        checked={settings.showNeighbooringPictures}
                                        onCheckedChange={(checked) =>
                                            setSettings((settings) => ({
                                                ...settings,
                                                showNeighbooringPictures: checked,
                                            }))
                                        }
                                    />
                                    <span className={cn(!settings.showNeighbooringPictures && 'opacity-25')}>
                                        mit Vorschau
                                    </span>
                                </label>
                                <Button variant="ghost" onClick={() => setOpen(false)}>
                                    <X />
                                </Button>
                            </div>
                        </div>
                        <div className="flex justify-center items-center h-[90%] gap-2 px-2">
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
                    </>
                )}
            </Dialog.Content>
        </Dialog.Root>
    );
}
