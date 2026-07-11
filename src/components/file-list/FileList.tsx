import { FileListRow } from './FileListRow';
import { useFileListFocusContext } from './fileListFocusContext';
import { File, useOrganizerContext } from '../../routes/main-screen/organizerContext';

export function FileList({
    files,
    id,
    removeTag,
    onSelect,
}: {
    files: File[];
    id: string;
    removeTag: (index: number) => void;
    onSelect: (index: number) => void;
}) {
    const { fileListId, selectedIndex } = useFileListFocusContext();
    const { markedPaths } = useOrganizerContext();
    const isActive = id === fileListId;

    return (
        <div className="w-full">
            {files.map((file, i) => (
                <FileListRow
                    key={file.path}
                    file={file}
                    selected={isActive && i === selectedIndex}
                    marked={markedPaths.includes(file.path)}
                    onClick={() => onSelect(i)}
                    removeTag={() => removeTag(i)}
                />
            ))}
        </div>
    );
}
