import React from "react";
import { File } from "../../routes/main-screen/organizerContext";

export const FileListFocusContext = React.createContext<{
  fileListId: string | null;
  selectedIndex: number | null;
  setFocus: (fileListId: string | null, selectedIndex: number | null) => void;
  file: File | null;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
} | null>(null);

export function FileListFocusContextProvider({
  children,
}: React.PropsWithChildren) {
  const [fileListId, setFileListId] = React.useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [file, setFile] = React.useState<File | null>(null);

  function setFocus(fileListId: string | null, selectedIndex: number | null) {
    setFileListId(fileListId);
    setSelectedIndex(selectedIndex);
  }

  return (
    <FileListFocusContext.Provider
      value={{ fileListId, selectedIndex, setFocus, file, setFile }}
    >
      {children}
    </FileListFocusContext.Provider>
  );
}

export function useFileListFocusContext() {
  const context = React.useContext(FileListFocusContext);
  if (context === null) throw Error("FileListFocusContext is null");

  return context;
}
