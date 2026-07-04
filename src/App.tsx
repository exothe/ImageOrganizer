import './App.css';
import { Outlet } from 'react-router-dom';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Button, Dialog, Progress } from '@radix-ui/themes';
import React from 'react';

export function App() {
    return (
        <>
            <Outlet />
            <Updater />
        </>
    );
}

function Updater() {
    const [open, setOpen] = React.useState(false);
    const [updateProgress, setUpdateProgress] = React.useState<{
        downloaded: number;
        contentLength: number;
        done: boolean;
    } | null>(null);
    const [update, setUpdate] = React.useState<Update | null>(null);

    React.useEffect(() => {
        checkForUpdates();
    }, []);

    async function checkForUpdates() {
        try {
            const update = await check();
            if (update) {
                setUpdate(update);
                setOpen(true);
            }
        } catch (e) {
            console.error('Check for updates failed:', e);
        }
    }

    async function downloadAndInstallUpdate() {
        if (update) {
            setUpdateProgress({
                downloaded: 0,
                contentLength: 0,
                done: false,
            });
            await update.downloadAndInstall((event) => {
                switch (event.event) {
                    case 'Started':
                        setUpdateProgress((progress) =>
                            progress
                                ? {
                                      ...progress,
                                      contentLength: event.data.contentLength ?? 0,
                                  }
                                : null,
                        );
                        break;
                    case 'Progress':
                        setUpdateProgress((progress) =>
                            progress
                                ? {
                                      ...progress,
                                      downloaded: progress.downloaded + event.data.chunkLength,
                                  }
                                : null,
                        );
                        break;
                    case 'Finished':
                        setUpdateProgress((progress) =>
                            progress
                                ? {
                                      ...progress,
                                      done: true,
                                  }
                                : null,
                        );
                        break;
                }
            });

            await relaunch();
        }
    }

    const updatePercentageProgress = updateProgress
        ? updateProgress.contentLength !== 0
            ? Math.min(Math.round((updateProgress.downloaded / updateProgress.contentLength) * 100), 100)
            : 0
        : null;

    return (
        <Dialog.Root open={open}>
            <Dialog.Content className="flex flex-col gap-2">
                <Dialog.Title>Neues Update verfügbar</Dialog.Title>
                <Dialog.Description>
                    {updateProgress
                        ? 'Update wird heruntergeladen und installiert...'
                        : 'Soll das Update heruntergeladen und installiert werden?'}
                </Dialog.Description>
                {updateProgress ? (
                    <div className="flex gap-2 items-center">
                        <Progress value={updatePercentageProgress} color={updateProgress.done ? 'green' : 'indigo'} />
                        <div>{updatePercentageProgress} %</div>
                    </div>
                ) : (
                    <div className="w-full flex justify-start gap-2">
                        <Button onClick={() => downloadAndInstallUpdate()}>Ja</Button>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Nein
                        </Button>
                    </div>
                )}
            </Dialog.Content>
        </Dialog.Root>
    );
}
