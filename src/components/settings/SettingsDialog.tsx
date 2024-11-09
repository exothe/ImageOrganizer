import { Button, Dialog } from "@radix-ui/themes";
import React from "react";
import { SaveAction, useSettingsContext } from "./SettingsContext";
import { Option, Select } from "../../lib/select/Select";

export function SettingsDialog({
  children,
  ...props
}: React.PropsWithChildren<Dialog.TriggerProps>) {
  const { settings, setSettings } = useSettingsContext();

  return (
    <Dialog.Root>
      <Dialog.Trigger {...props}>{children}</Dialog.Trigger>
      <Dialog.Content className="flex flex-col gap-2">
        <div className="flex justify-between gap-4 items-center">
          <div>Speicheraktion</div>
          <Select
            value={settings.saveAction}
            onValueChange={(value) =>
              setSettings((settings) => ({
                ...settings,
                saveAction: value as SaveAction,
              }))
            }
          >
            <Option value="copy">Kopieren</Option>
            <Option value="move">Verschieben</Option>
          </Select>
        </div>
        <div className="w-full flex justify-end">
          <Dialog.Close>
            <Button>Schließen</Button>
          </Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
