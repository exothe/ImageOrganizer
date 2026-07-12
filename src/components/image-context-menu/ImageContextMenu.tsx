import { ContextMenu } from '@radix-ui/themes';
import React from 'react';
import { api } from '../../api';
import { useSettingsContext } from '../settings/SettingsContext';

// Right-click menu for any displayed image: open the file in an external program
// (configured in the settings, e.g. GIMP) or in the system default viewer.
export function ImageContextMenu({ path, children }: React.PropsWithChildren<{ path: string }>) {
    const { settings } = useSettingsContext();
    const editor = settings.externalImageEditor.trim();

    async function open(program?: string) {
        try {
            await api.openFileWith(path, program);
        } catch (error) {
            alert(typeof error === 'string' ? error : `Programm konnte nicht gestartet werden: ${error}`);
        }
    }

    return (
        <ContextMenu.Root>
            <ContextMenu.Trigger>{children}</ContextMenu.Trigger>
            <ContextMenu.Content>
                {editor !== '' && (
                    <ContextMenu.Item onSelect={() => open(editor)}>Mit {editor} öffnen</ContextMenu.Item>
                )}
                <ContextMenu.Item onSelect={() => open()}>Im Standardprogramm öffnen</ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
    );
}
