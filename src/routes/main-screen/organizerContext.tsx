import React from 'react';
interface OrganizerContext {
    unreviewedFiles: File[];
    setUnreviewedFiles: React.Dispatch<React.SetStateAction<File[]>>;
    acceptedFiles: File[];
    setAcceptedFiles: React.Dispatch<React.SetStateAction<File[]>>;
    markedPaths: string[];
    setMarkedPaths: React.Dispatch<React.SetStateAction<string[]>>;
}

export const OrganizerContext = React.createContext<OrganizerContext | null>(null);

export type File = {
    path: string;
    tag?: string;
};

export function OrganizerContextProvider({ children }: React.PropsWithChildren) {
    const [unreviewedFiles, setUnreviewedFiles] = React.useState<File[]>([]);
    const [acceptedFiles, setAcceptedFiles] = React.useState<File[]>([]);
    const [markedPaths, setMarkedPaths] = React.useState<string[]>([]);

    return (
        <OrganizerContext.Provider
            value={{
                unreviewedFiles,
                setUnreviewedFiles,
                acceptedFiles,
                setAcceptedFiles,
                markedPaths,
                setMarkedPaths,
            }}
        >
            {children}
        </OrganizerContext.Provider>
    );
}

export function useOrganizerContext() {
    const context = React.useContext(OrganizerContext);
    if (!context) throw Error('OrganizerContext is null');

    return context;
}
