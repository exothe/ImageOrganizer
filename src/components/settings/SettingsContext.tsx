import React from "react";

export type SaveAction = "copy" | "move";

type Settings = {
  saveAction: SaveAction;
};

export const SettingsContext = React.createContext<{
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
} | null>(null);

export function SettingsContextProvider({ children }: React.PropsWithChildren) {
  const [settings, setSettings] = React.useState<Settings>({
    saveAction: "copy",
  });

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = React.useContext(SettingsContext);

  if (!context) {
    throw Error("useSettingsContext must be used within SettingsContext");
  }

  return context;
}
