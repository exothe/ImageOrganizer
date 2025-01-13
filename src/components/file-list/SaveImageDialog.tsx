import { Button, Dialog } from '@radix-ui/themes';
import { SaveImageResult } from '../../model/model';
import React from 'react';
import { X } from 'lucide-react';
import { useOrganizerContext } from '../../routes/main-screen/organizerContext';
import { getBasename } from '../../common/functions';

export function SaveImageDialog({ saveImageResult }: { saveImageResult?: SaveImageResult }) {
    const [open, setOpen] = React.useState<boolean>(false);
    const { setAcceptedFiles } = useOrganizerContext();

    React.useEffect(() => {
        if (saveImageResult) {
            setOpen(true);

            if (Object.keys(saveImageResult.renamed_files).length > 0) {
                setAcceptedFiles((acceptedFiles) =>
                    acceptedFiles.map((file) =>
                        file.path in saveImageResult.renamed_files
                            ? {
                                  path: saveImageResult.renamed_files[file.path],
                                  tag: file.tag,
                              }
                            : file,
                    ),
                );
            }
        }
    }, [saveImageResult, setAcceptedFiles]);

    function clearAcceptedFiles() {
        if (saveImageResult) {
            setAcceptedFiles((acceptedFiles) =>
                acceptedFiles.filter(
                    (file) =>
                        !Object.values(saveImageResult.renamed_files).includes(file.path) &&
                        !saveImageResult.successfully_saved_files.includes(file.path),
                ),
            );
        }
        setOpen(false);
    }

    const hasError =
        saveImageResult && (Object.keys(saveImageResult.errors).length > 0 || saveImageResult.global_errors.length > 0);
    const success = saveImageResult && saveImageResult.successfully_saved_files.length > 0;

    return (
        <Dialog.Root open={open}>
            <Dialog.Content>
                <div className="flex justify-between pb-4">
                    <span></span>
                    <Dialog.Title className="text-xl">
                        {hasError && success
                            ? 'Dateien teilweise gespeichert'
                            : hasError
                              ? 'Fehler beim Speichern'
                              : 'Dateien erfolgreich gespeichert'}
                    </Dialog.Title>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        <X />
                    </Button>
                </div>
                {hasError && (
                    <div className="pb-4">
                        <h2>Es sind Fehler aufgetreten:</h2>
                        <ul className="list-disc list-inside">
                            {saveImageResult.global_errors.map((error, i) => (
                                <li key={i}>{error}</li>
                            ))}
                            {Object.entries(saveImageResult.errors).map(([file, error]) => (
                                <li key={file}>
                                    {getBasename(file)}: {error}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {success && (
                    <div>
                        <h2>
                            {hasError
                                ? 'Die Restlichen Dateien wurden gespeichert.'
                                : 'Alle Dateien wurden erfolgreich gespeichert.'}{' '}
                            Möchtest du sie aus der Liste entfernen?
                        </h2>
                        <div className="flex justify-center py-2">
                            <Button onClick={clearAcceptedFiles}>Gespeicherte entfernen</Button>
                        </div>
                    </div>
                )}
            </Dialog.Content>
        </Dialog.Root>
    );
}
