export type SaveImageResult = {
    successfully_saved_files: string[];
    errors: Record<string, string>;
    global_errors: string[];
    renamed_files: Record<string, string>;
};

export type RemoveFileResult = {
    success: boolean;
    failed_files: string[];
};
