import { open } from '@tauri-apps/plugin-dialog';
import { getMatches } from '@tauri-apps/plugin-cli';
import { sortBy } from 'lodash-es';
import React from 'react';
import { Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useKeyPressEvent } from 'react-use';
import { api } from '../../api';
import { getFileExtension } from '../../common/functions';
import { useFileListFocusContext } from '../../components/file-list/fileListFocusContext';
import { useSettingsContext } from '../../components/settings/SettingsContext';
import { SaveImageResult } from '../../model/model';
import { File, useOrganizerContext } from '../main-screen/organizerContext';

export const UNTAGGED_FILTER = '__UNTAGGED';

export interface ImageRouteContextValue {
    unreviewedFiles: File[];
    filteredAcceptedFiles: File[];
    fileTags: string[];
    selectedTags: string[];
    setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
    saveImageResult?: SaveImageResult;
    deleteConfirmationOpen: boolean;
    setDeleteConfirmationOpen: React.Dispatch<React.SetStateAction<boolean>>;
    importImages: () => void;
    saveImages: () => void;
    acceptAllFiles: () => void;
    unacceptFiles: () => void;
    clearUnreviewedImages: () => void;
    saveDeleteUnreviewedImages: () => void;
    tagFile: (mode: 'unreviewed' | 'accepted', index: number | null, tag?: string) => void;
    filteredIndexToUnfiltered: (index: number | null) => number | null;
    select: (id: string | null, index: number | null) => void;
    markedPaths: string[];
    markedFiles: MarkedFile[];
    decideMarkedFile: (path: string, direction: 'left' | 'right') => void;
    addMergedFile: (path: string) => void;
}

export interface MarkedFile {
    file: File;
    list: 'unreviewed' | 'accepted';
}

export function useImageRoute() {
    return useOutletContext<ImageRouteContextValue>();
}

export function ImageRoute() {
    const { unreviewedFiles, setUnreviewedFiles, acceptedFiles, setAcceptedFiles, markedPaths, setMarkedPaths } =
        useOrganizerContext();
    const { settings } = useSettingsContext();
    const { fileListId, selectedIndex, setFocus, setFiles } = useFileListFocusContext();
    const location = useLocation();
    // the comparison view has its own per-image controls; the list shortcuts must not fire there
    const onComparePage = location.pathname.startsWith('/image/compare');

    const [saveImageResult, setSaveImageResult] = React.useState<SaveImageResult | undefined>();
    const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = React.useState<boolean>(false);

    React.useEffect(() => {
        const addFiles = (paths: string[]) => {
            const images = paths.filter((p) => getFileExtension(p) !== undefined);
            if (images.length === 0) return;
            setUnreviewedFiles((prev) => [
                ...prev,
                ...images.filter((path) => !prev.some((f) => f.path === path)).map((path) => ({ path })),
            ]);
        };

        // Windows/Linux: files passed as CLI args
        getMatches()
            .then((matches) => {
                const fileArg = matches.args?.files?.value;
                const paths =
                    typeof fileArg === 'string'
                        ? [fileArg]
                        : Array.isArray(fileArg)
                          ? fileArg.filter((item): item is string => typeof item === 'string')
                          : [];
                addFiles(paths);
            })
            .catch(console.error);

        // macOS: files buffered in Rust state before this listener was registered
        api.getOpenWithFiles().then(addFiles).catch(console.error);
    }, [setUnreviewedFiles]);

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
                    (file.tag && selectedTags.includes(file.tag)) || (untaggedFilterActive && file.tag === undefined),
            );
        }
    }, [acceptedFiles, selectedTags]);

    async function importImages() {
        const files = await open({
            multiple: true,
            directory: false,
            filters: [
                {
                    extensions: ['svg', 'png', 'jpeg', 'jpg', 'webp', 'gif'],
                    name: 'image-filter',
                },
            ],
        });

        if (!files) {
            return;
        }

        const filteredFiles = (typeof files === 'string' ? [files] : files).filter((file) => {
            const hasExtension = getFileExtension(file) !== undefined;
            const inUnreviewedFiles = unreviewedFiles.some((it) => it.path === file);
            const inAcceptedFiles = acceptedFiles.some((it) => it.path === file);

            return hasExtension && !inUnreviewedFiles && !inAcceptedFiles;
        });

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

        const result = await api.saveFiles(
            filteredAcceptedFiles,
            Array.isArray(dir) ? dir[0] : dir,
            settings.saveAction,
            settings.sortVariant,
        );
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

    async function rejectFile(index: number | null) {
        if (index === null) return false;
        if (settings.deleteRemovedUnreviewedFiles) {
            const result = await api.saveDeleteFiles([unreviewedFiles[index]]);
            if (!result.success) {
                return false;
            }
        }
        setUnreviewedFiles((unreviewedFiles) => [
            ...unreviewedFiles.slice(0, index),
            ...unreviewedFiles.slice(index + 1),
        ]);
        return true;
    }

    function unacceptFile(index: number | null) {
        if (index === null) return;

        const file = acceptedFiles[index];
        setAcceptedFiles((acceptedFiles) => [...acceptedFiles.slice(0, index), ...acceptedFiles.slice(index + 1)]);
        setUnreviewedFiles((unreviewedFiles) => [...unreviewedFiles, file]);
    }

    function filteredIndexToUnfiltered(index: number | null) {
        if (index === null) return null;
        const path = filteredAcceptedFiles[index].path;
        const i = acceptedFiles.findIndex((file) => file.path === path);
        return i === -1 ? null : i;
    }

    function tagFile(mode: 'unreviewed' | 'accepted', index: number | null, tag?: string) {
        if (index === null) return;

        (mode === 'unreviewed' ? setUnreviewedFiles : setAcceptedFiles)((files) => {
            const newFiles = [...files];
            newFiles[index].tag = tag;
            return newFiles;
        });
    }

    function acceptAllFiles() {
        setAcceptedFiles((acceptedFiles) => [...acceptedFiles, ...unreviewedFiles]);
        setUnreviewedFiles([]);
    }

    function unacceptFiles() {
        setUnreviewedFiles((unreviewedFiles) => [...unreviewedFiles, ...filteredAcceptedFiles]);
        const affectedPaths = new Set(filteredAcceptedFiles.map((file) => file.path));
        setAcceptedFiles((acceptedFiles) => acceptedFiles.filter((file) => !affectedPaths.has(file.path)));
    }

    function clearUnreviewedImages() {
        if (settings.deleteRemovedUnreviewedFiles) {
            setDeleteConfirmationOpen(true);
        } else {
            setUnreviewedFiles([]);
        }
    }

    async function saveDeleteUnreviewedImages() {
        if (settings.deleteRemovedUnreviewedFiles) {
            const result = await api.saveDeleteFiles(unreviewedFiles);
            if (result.success) {
                setUnreviewedFiles([]);
            } else {
                setUnreviewedFiles((files) => files.filter((file) => result.failed_files.includes(file.path)));
            }
        }
    }

    // --- Marked files (spacebar) for the comparison view ---

    // files can leave the lists in many ways (save, clear, reject, ...) — drop stale marks centrally
    React.useEffect(() => {
        setMarkedPaths((prev) => {
            const next = prev.filter(
                (path) => unreviewedFiles.some((f) => f.path === path) || acceptedFiles.some((f) => f.path === path),
            );
            return next.length === prev.length ? prev : next;
        });
    }, [unreviewedFiles, acceptedFiles, setMarkedPaths]);

    const markedFiles = React.useMemo<MarkedFile[]>(() => {
        const marked = new Set(markedPaths);
        return [
            ...unreviewedFiles
                .filter((file) => marked.has(file.path))
                .map((file) => ({ file, list: 'unreviewed' as const })),
            ...acceptedFiles
                .filter((file) => marked.has(file.path))
                .map((file) => ({ file, list: 'accepted' as const })),
        ];
    }, [markedPaths, unreviewedFiles, acceptedFiles]);

    function toggleMarked(path: string) {
        setMarkedPaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
    }

    async function decideMarkedFile(path: string, direction: 'left' | 'right') {
        const unreviewedIndex = unreviewedFiles.findIndex((file) => file.path === path);
        if (unreviewedIndex !== -1) {
            if (direction === 'left') {
                if (!(await rejectFile(unreviewedIndex))) return;
            } else {
                acceptFile(unreviewedIndex);
            }
        } else {
            const acceptedIndex = acceptedFiles.findIndex((file) => file.path === path);
            if (acceptedIndex === -1 || direction === 'right') return;
            unacceptFile(acceptedIndex);
        }
        setMarkedPaths((prev) => prev.filter((p) => p !== path));
    }

    // A freshly merged photo joins the unreviewed list (first position, so it leads the compare
    // grid) and is marked in the same render batch — the stale-mark cleanup sees both updates.
    function addMergedFile(path: string) {
        setUnreviewedFiles((prev) => (prev.some((f) => f.path === path) ? prev : [{ path }, ...prev]));
        setMarkedPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
    }

    // --- Selection + keyboard shortcuts (shared by both child routes) ---

    const filesForId = React.useCallback(
        (id: string) => (id === 'unreviewedFiles' ? unreviewedFiles : filteredAcceptedFiles),
        [unreviewedFiles, filteredAcceptedFiles],
    );

    const select = React.useCallback(
        (id: string | null, index: number | null) => {
            if (id === null || index === null) {
                setFocus(null, null);
                setFiles({ current: null, previous: null, next: null });
            } else {
                const arr = filesForId(id);
                setFocus(id, index);
                setFiles({
                    current: arr[index] ?? null,
                    previous: arr[index - 1] ?? null,
                    next: arr[index + 1] ?? null,
                });
            }
        },
        [filesForId, setFocus, setFiles],
    );

    // Keep the selection valid (and files.current fresh) whenever the active list changes.
    React.useEffect(() => {
        if (fileListId === null || selectedIndex === null) return;
        const arr = filesForId(fileListId);
        if (arr.length === 0) {
            select(fileListId, null);
        } else if (selectedIndex > arr.length - 1) {
            select(fileListId, arr.length - 1);
        } else {
            select(fileListId, Math.max(selectedIndex, 0));
        }
    }, [selectedIndex, fileListId, filesForId, select]);

    function move(delta: number) {
        if (fileListId === null || selectedIndex === null) return;
        const arr = filesForId(fileListId);
        if (arr.length === 0) return;
        select(fileListId, Math.min(Math.max(selectedIndex + delta, 0), arr.length - 1));
    }

    useKeyPressEvent('ArrowDown', () => {
        if (onComparePage) return;
        move(1);
    });
    useKeyPressEvent('ArrowUp', () => {
        if (onComparePage) return;
        move(-1);
    });
    useKeyPressEvent('ArrowLeft', () => {
        if (onComparePage || selectedIndex === null) return;
        if (fileListId === 'unreviewedFiles') {
            rejectFile(selectedIndex);
        } else if (fileListId === 'acceptedFiles') {
            unacceptFile(filteredIndexToUnfiltered(selectedIndex));
        }
    });
    useKeyPressEvent('ArrowRight', () => {
        if (onComparePage) return;
        if (fileListId === 'unreviewedFiles') {
            acceptFile(selectedIndex);
        }
    });
    useKeyPressEvent(
        (e) => /^[a-z0-9]$/.test(e.key),
        (e) => {
            if (onComparePage || selectedIndex === null) return;
            if (fileListId === 'unreviewedFiles') {
                tagFile('unreviewed', selectedIndex, e.key);
                acceptFile(selectedIndex);
            } else if (fileListId === 'acceptedFiles') {
                tagFile('accepted', filteredIndexToUnfiltered(selectedIndex), e.key);
            }
        },
    );
    useKeyPressEvent(' ', (e) => {
        if (onComparePage || fileListId === null || selectedIndex === null) return;
        // don't hijack space when a control is focused (buttons, switches, ...)
        if (
            e.target instanceof HTMLElement &&
            e.target.closest('button, input, textarea, select, [role="switch"], [role="checkbox"]')
        ) {
            return;
        }
        const file = filesForId(fileListId)[selectedIndex];
        if (!file) return;
        e.preventDefault();
        toggleMarked(file.path);
    });

    const context: ImageRouteContextValue = {
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
        markedPaths,
        markedFiles,
        decideMarkedFile,
        addMergedFile,
    };

    return <Outlet context={context} />;
}
