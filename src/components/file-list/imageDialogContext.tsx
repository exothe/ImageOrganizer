import React from 'react';

export const ImageDialogContext = React.createContext<{
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
} | null>(null);

export function ImageDialogContextProvider({ children }: React.PropsWithChildren) {
    const [open, setOpen] = React.useState<boolean>(false);

    return <ImageDialogContext.Provider value={{ open, setOpen }}>{children}</ImageDialogContext.Provider>;
}

export function useImageDialogContext() {
    const context = React.useContext(ImageDialogContext);
    if (context === null) throw Error('ImageDialogContext is null');

    return context;
}
