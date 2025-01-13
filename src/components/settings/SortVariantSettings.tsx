import { CircleHelp } from 'lucide-react';
import { KeysOfUnion } from '../../common/types';
import { Option, Select } from '../../lib/select/Select';
import { Input } from '../input/Input';
import { SortVariant, useSettingsContext } from './SettingsContext';
import * as Tooltip from '@radix-ui/react-tooltip';

export function SortVariantSelect() {
    const { settings, setSettings } = useSettingsContext();

    const sortVariant = settings.sortVariant
        ? (Object.keys(settings.sortVariant)[0] as KeysOfUnion<SortVariant>)
        : '__unselected';

    function getSortVariantDefaultParams(sortVariant: KeysOfUnion<SortVariant>) {
        switch (sortVariant) {
            case 'creationdate':
                return { creationdate: { format: '%Y' } };
        }
    }

    return (
        <Select
            value={sortVariant}
            onValueChange={(value) =>
                setSettings((settings) => ({
                    ...settings,
                    sortVariant:
                        value === '__unselected'
                            ? undefined
                            : getSortVariantDefaultParams(value as KeysOfUnion<SortVariant>),
                }))
            }
        >
            <Option value="__unselected">Nicht sortieren</Option>
            <Option value="creationdate">Nach Erstellungsdatum</Option>
        </Select>
    );
}

export function SortVariantParamsForm() {
    const {
        settings: { sortVariant },
        setSettings,
    } = useSettingsContext();

    if (sortVariant === undefined) {
        return null;
    } else if ('creationdate' in sortVariant) {
        return (
            <div className="flex gap-2 items-center pl-6">
                <div className="flex gap-1 items-center">
                    Format:{' '}
                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <CircleHelp className="h-4 w-4" />
                        </Tooltip.Trigger>
                        <Tooltip.Content className="rounded-md border bg-popover p-1 shadow" sideOffset={4}>
                            <div>
                                <div>Platzhalter der Form %x werden durch einen bestimmten Wert ersetzt:</div>
                                <ul className="list-disc list-inside">
                                    <li>%Y: Jahreszahl (z.B. 2025)</li>
                                    <li>%y: letzten beiden Jahreszahlen (z.B. 25)</li>
                                    <li>%m: Monatszahl (01-12)</li>
                                    <li>%B: Monat als Wort (z.B. Januar)</li>
                                </ul>
                            </div>
                        </Tooltip.Content>
                    </Tooltip.Root>
                </div>
                <Input
                    value={sortVariant.creationdate.format}
                    onChange={(e) =>
                        setSettings((settings) => ({
                            ...settings,
                            sortVariant: {
                                creationdate: {
                                    format: e.target.value,
                                },
                            },
                        }))
                    }
                />
            </div>
        );
    }
}
