import { Button } from '@radix-ui/themes';
import { Image } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { Link } from 'react-router-dom';
import { getBasename } from '../../common/functions';
import { File } from '../../routes/main-screen/organizerContext';
import { Badge } from '../badge/Badge';
import * as Tooltip from '@radix-ui/react-tooltip';

export function FileListRow({
    file,
    selected,
    marked,
    onClick,
    removeTag,
}: {
    file: File;
    selected: boolean;
    marked: boolean;
    onClick: () => void;
    removeTag: () => void;
}) {
    return (
        <div
            className={twMerge(
                'bg-gray-100 hover:bg-gray-200 grid grid-cols-[10fr_1fr_50px] gap-2 items-center',
                marked && 'bg-gray-400 hover:bg-gray-500',
                selected && 'bg-blue-400 hover:bg-blue-500',
                marked && selected && 'bg-blue-600 hover:bg-blue-700',
            )}
            onClick={onClick}
        >
            <span>{getBasename(file.path)}</span>
            {file.tag ? (
                <Tooltip.Root delayDuration={300}>
                    <Tooltip.Trigger asChild>
                        <Badge className="w-[3ch] text-sm justify-self-end" onClick={removeTag}>
                            {file.tag.toUpperCase()}
                        </Badge>
                    </Tooltip.Trigger>
                    <Tooltip.Content className="rounded-md border bg-popover p-1 shadow" sideOffset={4}>
                        Zum Entfernen klicken
                    </Tooltip.Content>
                </Tooltip.Root>
            ) : (
                <div></div>
            )}
            <div className="py-0.5">
                <Button asChild className="cursor-pointer justify-self-end">
                    <Link to="/image/view">
                        <Image />
                    </Link>
                </Button>
            </div>
        </div>
    );
}
