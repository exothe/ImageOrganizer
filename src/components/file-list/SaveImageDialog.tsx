import { Button, Dialog } from "@radix-ui/themes";
import { SaveImageResult } from "../../model/model";
import React from "react";
import { X } from "lucide-react";
import { useOrganizerContext } from "../../routes/main-screen/organizerContext";
import { getBasename } from "../../common/functions";

export function SaveImageDialog({
  saveImageResult,
}: {
  saveImageResult?: SaveImageResult;
}) {
  const [open, setOpen] = React.useState<boolean>(false);
  const { setAcceptedFiles } = useOrganizerContext();

  React.useEffect(() => {
    if (saveImageResult) {
      setOpen(true);
    }
  }, [saveImageResult]);

  function clearAcceptedFiles() {
    if (saveImageResult) {
      setAcceptedFiles((acceptedFiles) =>
        acceptedFiles.filter(
          (file) => !saveImageResult.successfully_saved_files.includes(file),
        ),
      );
    }
    setOpen(false);
  }

  const hasError =
    saveImageResult && Object.keys(saveImageResult.errors).length > 0;
  const success =
    saveImageResult && saveImageResult.successfully_saved_files.length > 0;

  return (
    <Dialog.Root open={open}>
      <Dialog.Content>
        <div className="flex justify-between pb-4">
          <span></span>
          <h1 className="text-xl">
            {hasError && success
              ? "Dateien teilweise gespeichert"
              : hasError
                ? "Fehler beim Speichern"
                : "Dateien erfolgreich gespeichert"}
          </h1>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            <X />
          </Button>
        </div>
        {hasError && (
          <div className="pb-4">
            <h2>Es sind Fehler aufgetreten:</h2>
            <ul className="list-disc list-inside">
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
              Die Restlichen Dateien wurden gespeichert. Möchtest du sie aus der
              Liste entfernen?
            </h2>
            <div className="flex justify-center py-2">
              <Button onClick={clearAcceptedFiles}>
                Gespeicherte entfernen
              </Button>
            </div>
          </div>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
