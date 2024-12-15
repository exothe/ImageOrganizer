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
  Settings,
} from "lucide-react";
import { getFileExtension } from "../../common/functions";
import { SettingsDialog } from "../../components/settings/SettingsDialog";
import { useSettingsContext } from "../../components/settings/SettingsContext";
import { sortBy } from "lodash-es";
import { Combobox } from "../../components/combobox/Combobox";
import { Badge } from "../../components/badge/Badge";

const UNTAGGED_FILTER = "__UNTAGGED";

export function ImageOrganizer() {
  const {
    unreviewedFiles,
    setUnreviewedFiles,
    acceptedFiles,
    setAcceptedFiles,
  } = useOrganizerContext();

  const { settings } = useSettingsContext();

  const [saveImageResult, setSaveImageResult] = React.useState<
    SaveImageResult | undefined
  >();
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);

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
        const inUnreviewedFiles = unreviewedFiles.some(
          (it) => it.path === file,
        );
        const inAcceptedFiles = acceptedFiles.some((it) => it.path === file);

        return hasExtension && !inUnreviewedFiles && !inAcceptedFiles;
      },
    );

    setUnreviewedFiles((unreviewedFiles) => [
      ...unreviewedFiles,
      ...filteredFiles.map((file) => ({
        path: file,
      })),
    ]);
  }

  async function saveImages() {
    const dir = await open({ directory: true });
    if (dir === null) return;

    const result: SaveImageResult = await invoke("save_files", {
      files: filteredAcceptedFiles,
      targetDirectory: dir,
      saveAction: settings.saveAction,
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

  function filteredIndexToUnfiltered(index: number | null) {
    if (index === null) return null;
    const path = filteredAcceptedFiles[index].path;
    const i = acceptedFiles.findIndex((file) => file.path === path);
    return i === -1 ? null : i;
  }

  function tagFile(
    mode: "unreviewed" | "accepted",
    index: number | null,
    tag?: string,
  ) {
    if (index === null) return;

    (mode === "unreviewed" ? setUnreviewedFiles : setAcceptedFiles)((files) => {
      const newFiles = [...files];
      newFiles[index].tag = tag;
      return newFiles;
    });
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

  const fileTags = React.useMemo(() => {
    const tags = new Set(acceptedFiles.map((file) => file.tag));
    return sortBy([...tags].filter((tag) => tag !== undefined) as string[]);
  }, [acceptedFiles]);

  React.useEffect(() => {
    setSelectedTags((tags) => tags.filter((tag) => fileTags.includes(tag)));
  }, [setSelectedTags, fileTags]);

  const filteredAcceptedFiles = React.useMemo(() => {
    if (selectedTags.length === 0) {
      return acceptedFiles;
    } else {
      const untaggedFilterActive = selectedTags.includes(UNTAGGED_FILTER);
      return acceptedFiles.filter(
        (file) =>
          (file.tag && selectedTags.includes(file.tag)) ||
          (untaggedFilterActive && file.tag === undefined),
      );
    }
  }, [acceptedFiles, selectedTags]);

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
          {fileTags.length > 0 ? (
            <Combobox
              options={[
                { value: UNTAGGED_FILTER, label: "ohne tag" },
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
                    <div className="italic">{item.label}</div>
                  ) : (
                    <Badge className="w-[3ch] text-sm justify-self-end">
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
        <FileListFocusContextProvider>
          <ImageDialogContextProvider>
            <FileList
              files={unreviewedFiles}
              keymap={{
                left: rejectFile,
                right: acceptFile,
                tagKey: (index: number | null, tag: string) => {
                  tagFile("unreviewed", index, tag);
                  acceptFile(index);
                },
              }}
              removeTag={(index: number) =>
                tagFile("unreviewed", index, undefined)
              }
              id="unreviewedFiles"
            />
            <FileList
              files={filteredAcceptedFiles}
              keymap={{
                left: (index: any) => {
                  unacceptFile(filteredIndexToUnfiltered(index));
                },
                tagKey: (index: number | null, tag: string) =>
                  tagFile("accepted", filteredIndexToUnfiltered(index), tag),
              }}
              removeTag={(index: number) =>
                tagFile("accepted", filteredIndexToUnfiltered(index), undefined)
              }
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
