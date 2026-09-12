import React from 'react';
import { z } from 'zod';
import { api } from '../../api';

export type SaveAction = 'copy' | 'move';

export const SortVariant = z.object({
    creationdate: z.object({ format: z.string() }),
});
export type SortVariant = z.infer<typeof SortVariant>;

// Every setting is persisted as its own row in the sqlite settings table. The
// schema validates what comes back from the database — an unknown or broken
// value falls back to the default below instead of breaking the app.
const SettingsSchema = z.object({
    saveAction: z.union([z.literal('copy'), z.literal('move')]),
    sortVariant: SortVariant.nullish().transform((value) => value ?? undefined),
    showNeighbooringPictures: z.boolean(),
    deleteRemovedUnreviewedFiles: z.boolean(),
    // program for "open image externally" (macOS: app name, else command); empty = hide the menu entry
    externalImageEditor: z.string(),
});

type Settings = z.infer<typeof SettingsSchema>;

const DEFAULT_SETTINGS: Settings = {
    saveAction: 'copy',
    showNeighbooringPictures: true,
    deleteRemovedUnreviewedFiles: false,
    externalImageEditor: 'GIMP',
};

export const SettingsContext = React.createContext<{
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
} | null>(null);

// Validates each stored row on its own, so one bad value only resets that
// single setting.
function mergeStoredSettings(stored: Record<string, unknown>): Settings {
    const settings = { ...DEFAULT_SETTINGS };

    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
        if (!(key in stored)) {
            continue;
        }

        const parsed = SettingsSchema.shape[key].safeParse(stored[key]);
        if (parsed.success) {
            // the key/value pairing is guaranteed by the shape lookup above
            settings[key] = parsed.data as never;
        } else {
            console.error(`Invalid stored value for setting "${key}":`, parsed.error);
        }
    }

    return settings;
}

// undefined is dropped by JSON.stringify, which would leave a stale row behind,
// so optional settings are written as explicit null.
function toStorableSettings(settings: Settings): Record<string, unknown> {
    return Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value ?? null]));
}

export function SettingsContextProvider({ children }: React.PropsWithChildren) {
    const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
    const [loaded, setLoaded] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        api.getSettings()
            .then((stored) => {
                if (!cancelled) {
                    setSettings(mergeStoredSettings(stored));
                }
            })
            .catch((error) => console.error('Loading settings failed:', error))
            .finally(() => {
                if (!cancelled) {
                    setLoaded(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        // don't write the defaults back before the stored settings arrived
        if (!loaded) {
            return;
        }

        api.setSettings(toStorableSettings(settings)).catch((error) => console.error('Saving settings failed:', error));
    }, [settings, loaded]);

    // rendering before the settings are known would let components act on the
    // defaults (and flash the wrong UI state) for a frame
    if (!loaded) {
        return null;
    }

    return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>;
}

export function useSettingsContext() {
    const context = React.useContext(SettingsContext);

    if (!context) {
        throw Error('useSettingsContext must be used within SettingsContext');
    }

    return context;
}
