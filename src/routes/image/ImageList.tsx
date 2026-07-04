import { Dialog } from '@radix-ui/themes';
import { FileList } from '../../components/file-list/FileList';
import { SaveImageDialog } from '../../components/file-list/SaveImageDialog';
import { ArrowBigLeft, ArrowBigRight, ArrowDownToLine, ArrowUpFromLine, EllipsisVertical, Settings } from 'lucide-react';
import { SettingsDialog } from '../../components/settings/SettingsDialog';
import { useSettingsContext } from '../../components/settings/SettingsContext';
import { Combobox } from '../../components/combobox/Combobox';
import { Badge } from '../../components/badge/Badge';
import { Switch } from '../../components/switch/Switch';
import { cn } from '../../components/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/popover/Popover';
import { Button } from '../../components/button/Button';
import { ButtonGroup } from '../../components/button/ButtonGroup';
import { UNTAGGED_FILTER, useImageRoute } from './ImageRoute';

export function ImageList() {
    const { settings, setSettings } = useSettingsContext();
    const {
        unreviewedFiles,
        filteredAcceptedFiles,
        fileTags,
        selectedTags,
        setSelectedTags,
        saveImageResult,
        deleteConfirmationOpen,
        setDeleteConfirmationOpen,
        importImages,
        saveImages,
        acceptAllFiles,
        unacceptFiles,
        clearUnreviewedImages,
        saveDeleteUnreviewedImages,
        tagFile,
        filteredIndexToUnfiltered,
        select,
    } = useImageRoute();

    return (
        <div className="p-2">
            <div className="flex justify-between items-center w-full p-2">
                <div />
                <h1 className="text-3xl font-bold">Bildorganisierer</h1>
                <SettingsDialog>
                    <Button variant="ghost">
                        <Settings />
                    </Button>
                </SettingsDialog>
            </div>
            <div className="grid grid-cols-2 gap-2 justify-items-center">
                <div className="flex justify-between w-full items-center">
                    <div>
                        <ButtonGroup>
                            <Button
                                variant={settings.deleteRemovedUnreviewedFiles ? 'destructive' : undefined}
                                onClick={clearUnreviewedImages}
                                // variant="soft"
                            >
                                <ArrowBigLeft />
                            </Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={settings.deleteRemovedUnreviewedFiles ? 'destructive' : undefined}>
                                        <EllipsisVertical />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full">
                                    <label className="p-2 h-8 flex gap-2 items-center text-sm">
                                        <span className={cn(settings.deleteRemovedUnreviewedFiles && 'opacity-25')}>
                                            nicht löschen
                                        </span>
                                        <Switch
                                            className="data-[state=checked]:bg-destructive"
                                            checked={settings.deleteRemovedUnreviewedFiles}
                                            onCheckedChange={(checked) =>
                                                setSettings((settings) => ({
                                                    ...settings,
                                                    deleteRemovedUnreviewedFiles: checked,
                                                }))
                                            }
                                        />
                                        <span className={cn(!settings.deleteRemovedUnreviewedFiles && 'opacity-25')}>
                                            löschen
                                        </span>
                                    </label>
                                </PopoverContent>
                            </Popover>
                        </ButtonGroup>
                    </div>
                    <div>{unreviewedFiles.length} Bilder</div>
                    <Button onClick={importImages}>
                        Bilder importieren <ArrowDownToLine />
                    </Button>
                    <div />
                    <Button title="Alle Bilder akzeptieren" onClick={acceptAllFiles}>
                        <ArrowBigRight />
                    </Button>
                </div>
                <div className="flex justify-between w-full items-center">
                    <Button title="Alle Bilder zurücknehmen" onClick={unacceptFiles}>
                        <ArrowBigLeft />
                    </Button>
                    <div>{filteredAcceptedFiles.length} Bilder</div>
                    <Button onClick={saveImages}>
                        Bilder speichern <ArrowUpFromLine />
                    </Button>
                    <div />
                    {fileTags.length > 0 ? (
                        <Combobox
                            options={[
                                { value: UNTAGGED_FILTER, label: 'ohne tag' },
                                ...fileTags.map((tag) => ({
                                    value: tag,
                                    label: tag.toUpperCase(),
                                })),
                            ]}
                            itemElement={(item) =>
                                item.value === UNTAGGED_FILTER ? (
                                    <div className="italic">{item.label}</div>
                                ) : (
                                    <Badge className="w-[3ch] text-sm justify-self-end">
                                        {item.label.toUpperCase()}
                                    </Badge>
                                )
                            }
                            previewFn={(items) =>
                                items.map((item) =>
                                    item.value === UNTAGGED_FILTER ? (
                                        <div key={item.value} className="italic">
                                            {item.label}
                                        </div>
                                    ) : (
                                        <Badge key={item.value} className="w-[3ch] text-sm justify-self-end">
                                            {item.label.toUpperCase()}
                                        </Badge>
                                    ),
                                )
                            }
                            value={selectedTags}
                            setValue={setSelectedTags}
                            emptyPreviewText="Nach Tag filtern"
                        />
                    ) : (
                        <div />
                    )}
                </div>
                <FileList
                    files={unreviewedFiles}
                    id="unreviewedFiles"
                    onSelect={(index) => select('unreviewedFiles', index)}
                    removeTag={(index: number) => tagFile('unreviewed', index, undefined)}
                />
                <FileList
                    files={filteredAcceptedFiles}
                    id="acceptedFiles"
                    onSelect={(index) => select('acceptedFiles', index)}
                    removeTag={(index: number) => tagFile('accepted', filteredIndexToUnfiltered(index), undefined)}
                />
                <SaveImageDialog saveImageResult={saveImageResult} />
            </div>
            <Dialog.Root open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
                <Dialog.Content>
                    <Dialog.Title>Alle Dateien in dieser Liste löschen?</Dialog.Title>
                    <Dialog.Description>
                        Die Dateien in dieser Liste werden in den Papierkorb verschoben und anschließend aus dieser
                        Liste entfernt.
                    </Dialog.Description>
                    <div className="w-full flex gap-2 justify-end">
                        <Dialog.Close>
                            <Button variant="outline" color="gray">
                                Abbrechen
                            </Button>
                        </Dialog.Close>
                        <Dialog.Close>
                            <Button color="red" onClick={saveDeleteUnreviewedImages}>
                                Löschen
                            </Button>
                        </Dialog.Close>
                    </div>
                </Dialog.Content>
            </Dialog.Root>
        </div>
    );
}
