import { FileListRow } from "./FileListRow";
import { useKeyPressEvent } from "react-use";
import { useFileListFocusContext } from "./fileListFocusContext";
import React from "react";
import { File } from "../../routes/main-screen/organizerContext";

interface Keymap {
  left?: (index: number | null) => void;
  right?: (index: number | null) => void;
  tagKey?: (index: number | null, tag: string) => void;
}

export function FileList({
  files,
  keymap,
  id,
  removeTag,
}: {
  files: File[];
  keymap?: Keymap;
  id: string;
  removeTag: (index: number) => void;
}) {
  const { fileListId, selectedIndex, setFocus, setFiles } =
    useFileListFocusContext();

  function isActive() {
    return id === fileListId;
  }

  const selectRow = React.useCallback(
    (index: number | null) => {
      if (index === null) {
        setFocus(null, null);
        setFiles({ current: null, next: null, previous: null });
      } else {
        setFocus(id, index);
        setFiles({
          current: files[index],
          previous: files[index - 1] ?? null,
          next: files[index + 1] ?? null,
        });
      }
    },
    [files, id, setFiles, setFocus],
  );

  React.useEffect(() => {
    if (!isActive() || selectedIndex === null) {
      return;
    } else if (files.length === 0) {
      selectRow(null);
    } else if (selectedIndex > files.length - 1) {
      selectRow(files.length - 1);
    } else if (selectedIndex < 0) {
      selectRow(0);
    } else {
      selectRow(selectedIndex);
    }
  }, [selectedIndex, selectRow, files]);

  useKeyPressEvent(
    "ArrowDown",
    () =>
      isActive() &&
      selectRow(
        selectedIndex !== null
          ? Math.min(selectedIndex + 1, files.length - 1)
          : null,
      ),
  );
  useKeyPressEvent(
    "ArrowUp",
    () =>
      isActive() &&
      selectRow(selectedIndex !== null ? Math.max(selectedIndex - 1, 0) : null),
  );
  useKeyPressEvent(
    "ArrowLeft",
    () => isActive() && keymap?.left?.(selectedIndex),
  );
  useKeyPressEvent(
    "ArrowRight",
    () => isActive() && keymap?.right?.(selectedIndex),
  );
  useKeyPressEvent(
    (e) => /^[a-z0-9]$/.test(e.key),
    (e) => isActive() && keymap?.tagKey?.(selectedIndex, e.key),
  );

  return (
    <div className="w-full">
      {files.map((file, i) => (
        <FileListRow
          key={file.path}
          file={file}
          selected={isActive() && i === selectedIndex}
          onClick={() => selectRow(i)}
          removeTag={() => removeTag(i)}
        />
      ))}
    </div>
  );
}
