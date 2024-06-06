import { Button } from "@radix-ui/themes";
import { FileList } from "../../components/file-list/FileList";
import { useOrganizerContext } from "./organizerContext";
import { open } from "@tauri-apps/api/dialog";
import { FileListFocusContextProvider } from "../../components/file-list/fileListFocusContext";
import { ImageDialogContextProvider } from "../../components/file-list/imageDialogContext";
import { ImageDialog } from "../../components/file-list/ImageDialog";
import { invoke } from "@tauri-apps/api";
import { SaveImageDialog } from "../../components/file-list/SaveImageDialog";
import { SaveImageResult } from "../../model/model";
import React from "react";
import {
  ArrowBigLeft,
  ArrowBigRight,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { getFileExtension } from "../../common/functions";

export function ImageOrganizer() {
  const {
    unreviewedFiles,
    setUnreviewedFiles,
    acceptedFiles,
    setAcceptedFiles,
  } = useOrganizerContext();

  const [saveImageResult, setSaveImageResult] = React.useState<
    SaveImageResult | undefined
  >();

  async function importImages() {
    const files = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          extensions: ["svg", "png", "jpeg", "jpg", "webp", "gif"],
          name: "image-filter",
        },
      ],
    });

    if (!files) {
      return;
    }

    const filteredFiles = (typeof files === "string" ? [files] : files).filter(
      (file) => {
        const hasExtension = getFileExtension(file) !== undefined;
        const inUnreviewedFiles = unreviewedFiles.includes(file);
        const inAcceptedFiles = acceptedFiles.includes(file);

        return hasExtension && !inUnreviewedFiles && !inAcceptedFiles;
      },
    );

    setUnreviewedFiles((unreviewedFiles) => [
      ...unreviewedFiles,
      ...filteredFiles,
    ]);
  }

  async function saveImages() {
    const dir = await open({ directory: true });
    if (dir === null) return;

    const result: SaveImageResult = await invoke("save_files", {
      paths: acceptedFiles,
      targetDirectory: dir,
    });
    setSaveImageResult(result);
  }

  function acceptFile(index: number | null) {
    if (index === null) return;

    const file = unreviewedFiles[index];
    setUnreviewedFiles((unreviewedFiles) => [
      ...unreviewedFiles.slice(0, index),
      ...unreviewedFiles.slice(index + 1),
    ]);
    setAcceptedFiles((acceptedFiles) => [...acceptedFiles, file]);
  }

  function rejectFile(index: number | null) {
    if (index === null) return;
    setUnreviewedFiles((unreviewedFiles) => [
      ...unreviewedFiles.slice(0, index),
      ...unreviewedFiles.slice(index + 1),
    ]);
  }

  function unacceptFile(index: number | null) {
    if (index === null) return;

    const file = acceptedFiles[index];
    setAcceptedFiles((acceptedFiles) => [
      ...acceptedFiles.slice(0, index),
      ...acceptedFiles.slice(index + 1),
    ]);
    setUnreviewedFiles((unreviewedFiles) => [...unreviewedFiles, file]);
  }

  function acceptAllFiles() {
    setAcceptedFiles((acceptedFiles) => [...acceptedFiles, ...unreviewedFiles]);
    setUnreviewedFiles([]);
  }

  function unacceptAllFiles() {
    setUnreviewedFiles((unreviewedFiles) => [
      ...unreviewedFiles,
      ...acceptedFiles,
    ]);
    setAcceptedFiles([]);
  }

  function clearUnreviewedImages() {
    setUnreviewedFiles([]);
  }

  return (
    <div className="p-2">
      <h1 className="text-3xl font-bold">Bildorganizierer</h1>
      <div className="grid grid-cols-2 gap-2 justify-items-center">
        <div className="flex justify-between w-full">
          <Button onClick={clearUnreviewedImages}>
            <ArrowBigLeft />
          </Button>
          <Button onClick={importImages}>
            Bilder importieren <ArrowDownToLine />
          </Button>
          <Button title="Alle Bilder akzeptieren" onClick={acceptAllFiles}>
            <ArrowBigRight />
          </Button>
        </div>
        <div className="flex justify-between w-full">
          <Button title="Alle Bilder zurücknehmen" onClick={unacceptAllFiles}>
            <ArrowBigLeft />
          </Button>
          <Button onClick={saveImages}>
            Bilder speichern <ArrowUpFromLine />
          </Button>
          <div></div>
        </div>
        <FileListFocusContextProvider>
          <ImageDialogContextProvider>
            <FileList
              files={unreviewedFiles}
              keymap={{ left: rejectFile, right: acceptFile }}
              id="unreviewedFiles"
            />
            <FileList
              files={acceptedFiles}
              keymap={{ left: unacceptFile }}
              id="acceptedFiles"
            />
            <ImageDialog />
            <SaveImageDialog saveImageResult={saveImageResult} />
          </ImageDialogContextProvider>
        </FileListFocusContextProvider>
      </div>
    </div>
  );
}
