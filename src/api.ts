import { invoke } from '@tauri-apps/api/core';
import { File } from './routes/main-screen/organizerContext';
import { SaveAction, SortVariant } from './components/settings/SettingsContext';
import { RemoveFileResult, SaveImageResult } from './model/model';

export const api = {
    async saveFiles(
        files: File[],
        targetDirectory: string,
        saveAction: SaveAction,
        sortVariant?: SortVariant,
    ): Promise<SaveImageResult> {
        return await invoke('save_files', {
            files,
            targetDirectory,
            saveAction,
            sortVariant,
        });
    },

    async saveDeleteFiles(files: File[]): Promise<RemoveFileResult> {
        return await invoke('save_delete_files', {
            files,
        });
    },
};
