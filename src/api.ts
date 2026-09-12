import { invoke } from '@tauri-apps/api/core';
import { File } from './routes/main-screen/organizerContext';
import { SaveAction, SortVariant } from './components/settings/SettingsContext';
import { DetectFacesResult, MergeFacesResult, RemoveFileResult, SaveImageResult } from './model/model';

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

    async getOpenWithFiles(): Promise<string[]> {
        return await invoke('get_open_with_files');
    },

    async openFileWith(path: string, program?: string): Promise<void> {
        return await invoke('open_file_with', { path, program });
    },

    async detectMergeFaces(paths: string[]): Promise<DetectFacesResult> {
        return await invoke('detect_merge_faces', { paths });
    },

    async mergeFaces(sessionId: number, selections: Record<number, string>): Promise<MergeFacesResult> {
        return await invoke('merge_faces', { sessionId, selections });
    },

    async getSettings(): Promise<Record<string, unknown>> {
        return await invoke('get_settings');
    },

    async setSettings(settings: Record<string, unknown>): Promise<void> {
        return await invoke('set_settings', { newSettings: settings });
    },

    async mergeFacesOra(sessionId: number, selections: Record<number, string>): Promise<MergeFacesResult> {
        return await invoke('merge_faces_ora', { sessionId, selections });
    },
};
