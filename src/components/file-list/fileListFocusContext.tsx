import React from 'react';
import { File } from '../../routes/main-screen/organizerContext';

type FileFocus = {
    current: File | null;
    previous: File | null;
    next: File | null;
};

export const FileListFocusContext = React.createContext<{
    fileListId: string | null;
    selectedIndex: number | null;
    setFocus: (fileListId: string | null, selectedIndex: number | null) => void;
    files: FileFocus;
    setFiles: React.Dispatch<React.SetStateAction<FileFocus>>;
} | null>(null);

export function FileListFocusContextProvider({ children }: React.PropsWithChildren) {
    const [fileListId, setFileListId] = React.useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
    const [files, setFiles] = React.useState<FileFocus>({
        current: null,
        previous: null,
        next: null,
    });

    const setFocus = React.useCallback(
        (fileListId: string | null, selectedIndex: number | null) => {
            setFileListId(fileListId);
            setSelectedIndex(selectedIndex);
        },
        [setFileListId, setSelectedIndex],
    );

    return (
        <FileListFocusContext.Provider value={{ fileListId, selectedIndex, setFocus, files, setFiles }}>
            {children}
        </FileListFocusContext.Provider>
    );
}

export function useFileListFocusContext() {
    const context = React.useContext(FileListFocusContext);
    if (context === null) throw Error('FileListFocusContext is null');

    return context;
}
