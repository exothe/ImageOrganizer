import React from "react";
interface OrganizerContext {
  unreviewedFiles: string[];
  setUnreviewedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  acceptedFiles: string[];
  setAcceptedFiles: React.Dispatch<React.SetStateAction<string[]>>;
}

export const OrganizerContext = React.createContext<OrganizerContext | null>(
  null,
);

export function OrganizerContextProvider({
  children,
}: React.PropsWithChildren) {
  const [unreviewedFiles, setUnreviewedFiles] = React.useState<string[]>([]);
  const [acceptedFiles, setAcceptedFiles] = React.useState<string[]>([]);

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
  if (!context) throw Error("OrganizerContext is null");

  return context;
}
