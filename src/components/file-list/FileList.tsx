import { FileListRow } from "./FileListRow";
import { useKeyPressEvent } from "react-use";
import { useFileListFocusContext } from "./fileListFocusContext";
import React from "react";

interface Keymap {
  left?: (index: number | null) => void;
  right?: (index: number | null) => void;
}

export function FileList({
  files,
  keymap,
  id,
}: {
  files: string[];
  keymap?: Keymap;
  id: string;
}) {
  const { fileListId, selectedIndex, setFocus, setFile } =
    useFileListFocusContext();

  function isActive() {
    return id === fileListId;
  }

  function selectRow(index: number | null) {
    if (index === null) {
      setFocus(null, null);
      setFile(null);
    } else {
      setFocus(id, index);
      setFile(files[index]);
    }
  }

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

  return (
    <div className="w-full">
      {files.map((file, i) => (
        <FileListRow
          key={file}
          file={file}
          selected={isActive() && i === selectedIndex}
          onClick={() => selectRow(i)}
        />
      ))}
    </div>
  );
}
