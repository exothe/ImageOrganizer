import { open } from '@tauri-apps/plugin-dialog';
import { getMatches } from '@tauri-apps/plugin-cli';
import { sortBy } from 'lodash-es';
import React from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
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
}

export function useImageRoute() {
    return useOutletContext<ImageRouteContextValue>();
}

export function ImageRoute() {
    const { unreviewedFiles, setUnreviewedFiles, acceptedFiles, setAcceptedFiles } = useOrganizerContext();
    const { settings } = useSettingsContext();
    const { fileListId, selectedIndex, setFocus, setFiles } = useFileListFocusContext();

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
        if (index === null) return;
        if (settings.deleteRemovedUnreviewedFiles) {
            const result = await api.saveDeleteFiles([unreviewedFiles[index]]);
            if (!result.success) {
                return;
            }
        }
        setUnreviewedFiles((unreviewedFiles) => [
            ...unreviewedFiles.slice(0, index),
            ...unreviewedFiles.slice(index + 1),
        ]);
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

    useKeyPressEvent('ArrowDown', () => move(1));
    useKeyPressEvent('ArrowUp', () => move(-1));
    useKeyPressEvent('ArrowLeft', () => {
        if (selectedIndex === null) return;
        if (fileListId === 'unreviewedFiles') {
            rejectFile(selectedIndex);
        } else if (fileListId === 'acceptedFiles') {
            unacceptFile(filteredIndexToUnfiltered(selectedIndex));
        }
    });
    useKeyPressEvent('ArrowRight', () => {
        if (fileListId === 'unreviewedFiles') {
            acceptFile(selectedIndex);
        }
    });
    useKeyPressEvent(
        (e) => /^[a-z0-9]$/.test(e.key),
        (e) => {
            if (selectedIndex === null) return;
            if (fileListId === 'unreviewedFiles') {
                tagFile('unreviewed', selectedIndex, e.key);
                acceptFile(selectedIndex);
            } else if (fileListId === 'acceptedFiles') {
                tagFile('accepted', filteredIndexToUnfiltered(selectedIndex), e.key);
            }
        },
    );

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
    };

    return <Outlet context={context} />;
}
