import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../popover/Popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../command/Command';
import { Button } from '@radix-ui/themes';
import { twMerge } from 'tailwind-merge';

export interface ComboboxProps<
    TValue extends string | null | string[],
    TItem extends {
        value: string;
        label: string;
    } = {
        value: string;
        label: string;
    },
> {
    options?: TItem[];
    value: TValue;
    setValue: (value: TValue) => void;
    emptyPreviewText?: string;
    postfixElement?: React.ReactNode;
    previewFn?: (item: TItem[]) => React.ReactNode;
    itemElement?: (item: TItem) => React.ReactNode;
    itemPrefixElement?: (item: TItem) => React.ReactNode;
    itemInfixElement?: (item: TItem) => React.ReactNode;
    itemPostfixElement?: (item: TItem) => React.ReactNode;
    disabled?: boolean;

    /** How many options are shown in the preview. If there are more options selected,
     * just their count will be displayed */
    maxPreviewCount?: number;

    /** If in single select mode, the value that represets no selection */
    emptyValue?: '' | null;

    /** trigger class name. */
    className?: string;
}

export function Combobox<
    TValue extends string | null | string[],
    TItem extends {
        value: string;
        label: string;
    } = {
        value: string;
        label: string;
    },
>({
    options = [],
    value,
    setValue,
    emptyPreviewText,
    postfixElement,
    previewFn,
    itemElement,
    itemPrefixElement,
    itemInfixElement,
    itemPostfixElement,
    disabled = false,
    maxPreviewCount = 3,
    emptyValue = '',
    className,
}: ComboboxProps<TValue, TItem>) {
    const multiSelection = Array.isArray(value);
    const [open, setOpen] = React.useState(false);
    const [hoveredItem, setHoveredItem] = React.useState<string | undefined>();

    const selectedOptions = options.filter((option) =>
        multiSelection ? value.includes(option.value) : value === option.value,
    );

    let optionPreview;
    if (previewFn) {
        if (multiSelection) {
            optionPreview = previewFn(options.filter((option) => value.includes(option.value)));
        } else {
            optionPreview = previewFn(options.filter((option) => value === option.value));
        }
    } else {
        optionPreview =
            selectedOptions.length > maxPreviewCount
                ? `${selectedOptions.length} ausgewählt`
                : selectedOptions.map((option) => option.label).join(', ');
    }

    function onSelect(option: TItem) {
        if (multiSelection) {
            setValue(
                (value.includes(option.value)
                    ? value.filter((o) => o !== option.value)
                    : [...value, option.value]) as TValue,
            );
        } else {
            setValue((value === option.value ? emptyValue : option.value) as TValue);
            setOpen(false);
        }
    }

    function isSelected(option: TItem) {
        return multiSelection ? value.includes(option.value) : value === option.value;
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild disabled={disabled}>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={twMerge('w-[300px] justify-between overflow-hidden', className)}
                >
                    {value && value.length > 0 ? optionPreview : (emptyPreviewText ?? 'Option wählen...')}
                    <ChevronsUpDown className="text-gray-300 w-4 h-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-fit min-w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Suche..." />
                    <CommandList>
                        <CommandEmpty>Keine Ergebnisse.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    onSelect={() => onSelect(option)}
                                    onMouseEnter={() => setHoveredItem(option.value)}
                                    onMouseLeave={() => setHoveredItem(undefined)}
                                    className="h-9 flex"
                                >
                                    {itemPrefixElement && itemPrefixElement(option)}
                                    {itemElement ? itemElement(option) : option.label}
                                    <div className="flex-1"></div>
                                    {itemInfixElement && hoveredItem === option.value && itemInfixElement(option)}
                                    <Check
                                        className={twMerge('ml-auto', isSelected(option) ? 'opacity-100' : 'opacity-0')}
                                    />
                                    {itemPostfixElement && itemPostfixElement(option)}
                                </CommandItem>
                            ))}
                            {postfixElement ?? null}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
