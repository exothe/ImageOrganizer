import { Content, Item, ItemText, Portal, Root, Trigger, Value, Viewport } from '@radix-ui/react-select';
import { ChevronsUpDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

/** Usage:
 * ```
 * <Select value={filter.kvRegion} onValueChange={(value) => changeKvRegion(value)}>
 *   {KvRegionEnum.options.sort().map((region) => (
 *     <Option value={region} key={region}>{region}</Option>
 *   ))}
 * </Select>
 * ```
 */

interface OptionProps extends React.ComponentPropsWithoutRef<typeof Item> {}

export function Option({ children, className, ...rest }: OptionProps) {
    return (
        <Item
            className={twMerge(
                'p-2 hover:bg-foreground/20 outline-none rounded text-sm hover:cursor-pointer',
                className,
            )}
            {...rest}
        >
            <ItemText>{children}</ItemText>
        </Item>
    );
}

interface SelectProps extends React.ComponentPropsWithoutRef<typeof Root> {
    label?: string;
}

export function Select({
    label,
    children,
    contentClassName,
    triggerClassName,
    container,
    ...rest
}: SelectProps & {
    contentClassName?: string;
    triggerClassName?: string;
    container?: HTMLElement | null;
}) {
    return (
        <Root {...rest}>
            <Trigger
                className={twMerge(
                    'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 text-black',
                    triggerClassName,
                )}
            >
                <Value placeholder={label} />
                <ChevronsUpDown className="text-gray-300 w-4 h-4" />
            </Trigger>
            <Portal container={container}>
                <Content
                    position="popper"
                    className={twMerge(
                        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                        'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
                        contentClassName,
                    )}
                >
                    <Viewport className="p-2 flex flex-col">{children}</Viewport>
                </Content>
            </Portal>
        </Root>
    );
}
