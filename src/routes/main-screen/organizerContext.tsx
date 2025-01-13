import React from 'react';
interface OrganizerContext {
    unreviewedFiles: File[];
    setUnreviewedFiles: React.Dispatch<React.SetStateAction<File[]>>;
    acceptedFiles: File[];
    setAcceptedFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

export const OrganizerContext = React.createContext<OrganizerContext | null>(null);

export type File = {
    path: string;
    tag?: string;
};

export function OrganizerContextProvider({ children }: React.PropsWithChildren) {
    const [unreviewedFiles, setUnreviewedFiles] = React.useState<File[]>([]);
    const [acceptedFiles, setAcceptedFiles] = React.useState<File[]>([]);

    return (
        <OrganizerContext.Provider
            value={{
                unreviewedFiles,
                setUnreviewedFiles,
                acceptedFiles,
                setAcceptedFiles,
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
