import { Button, Dialog } from '@radix-ui/themes';
import React from 'react';
import { SaveAction, useSettingsContext } from './SettingsContext';
import { Option, Select } from '../../lib/select/Select';
import { SortVariantParamsForm, SortVariantSelect } from './SortVariantSettings';
import { getVersion } from '@tauri-apps/api/app';
import { useEffectOnce } from 'react-use';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';

export function SettingsDialog({ children, ...props }: React.PropsWithChildren<Dialog.TriggerProps>) {
    const { settings, setSettings } = useSettingsContext();
    const [version, setVersion] = React.useState<string | undefined>();

    useEffectOnce(() => {
        getVersion().then((data) => setVersion(data));
    });

    return (
        <Dialog.Root>
            <Dialog.Trigger {...props}>{children}</Dialog.Trigger>
            <Dialog.Content className="flex flex-col gap-2">
                <div className="grid grid-cols-[40px_auto_40px]">
                    <div></div>
                    <Dialog.Title>Einstellungen</Dialog.Title>
                    <Tooltip.Root delayDuration={300}>
                        <Tooltip.Trigger asChild className="justify-self-end">
                            <Button variant="ghost" tabIndex={-1}>
                                <Info />
                            </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content className="rounded-md border bg-popover p-1 shadow" sideOffset={4}>
                            <div className="flex gap-2">
                                <div className="flex flex-col">
                                    <div className="font-bold text-xs">Version</div>
                                    <div className="text-base">{version ?? '-'}</div>
                                </div>
                            </div>
                        </Tooltip.Content>
                    </Tooltip.Root>
                </div>
                <div className="flex justify-between gap-4 items-center">
                    <div>Speicheraktion</div>
                    <Select
                        value={settings.saveAction}
                        onValueChange={(value) =>
                            setSettings((settings) => ({
                                ...settings,
                                saveAction: value as SaveAction,
                            }))
                        }
                    >
                        <Option value="copy">Kopieren</Option>
                        <Option value="move">Verschieben</Option>
                    </Select>
                </div>
                <div className="grid grid-cols-[1fr_5fr] gap-2 items-center">
                    <div className="whitespace-nowrap">Dateien sortieren</div>
                    <SortVariantSelect />
                </div>
                <SortVariantParamsForm />
                <div className="flex justify-between gap-4 items-center">
                    <div className="whitespace-nowrap">Bildvorschau anzeigen</div>
                    <Select
                        value={String(settings.showNeighbooringPictures)}
                        onValueChange={(value) =>
                            setSettings((settings) => ({
                                ...settings,
                                showNeighbooringPictures: value === 'true',
                            }))
                        }
                    >
                        <Option value="true">Ja</Option>
                        <Option value="false">Nein</Option>
                    </Select>
                </div>
                <div className="flex justify-between gap-4 items-center">
                    <div className="whitespace-nowrap">Dateien löschen, wenn Sie aus der linken Liste gehen?</div>
                    <Select
                        value={String(settings.deleteRemovedUnreviewedFiles)}
                        onValueChange={(value) =>
                            setSettings((settings) => ({
                                ...settings,
                                deleteRemovedUnreviewedFiles: value === 'true',
                            }))
                        }
                    >
                        <Option value="true">Ja</Option>
                        <Option value="false">Nein</Option>
                    </Select>
                </div>
                <div className="w-full flex justify-end">
                    <Dialog.Close>
                        <Button>Schließen</Button>
                    </Dialog.Close>
                </div>
            </Dialog.Content>
        </Dialog.Root>
    );
}
