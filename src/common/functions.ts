export function getBasename(path: string) {
    return path.split(/[\\/]/).pop();
}

export function getFileExtension(path: string): string | undefined {
    const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    const base = path.substring(index + 1);
    if (base.lastIndexOf('.') != -1) {
        const extension = base.substring(base.lastIndexOf('.') + 1);
        if (extension !== '') {
            return extension;
        }
    }
}
