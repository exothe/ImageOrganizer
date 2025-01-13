import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Badge = React.forwardRef<
    HTMLDivElement,
    React.PropsWithChildren<
        {
            className?: string;
        } & React.HTMLAttributes<HTMLDivElement>
    >
>(({ children, className, ...props }, ref) => (
    <div
        ref={ref}
        {...props}
        className={twMerge(
            'bg-pink-300 rounded-xl grid place-items-center h-fit',
            props.onClick && 'cursor-pointer',
            className,
        )}
    >
        {children}
    </div>
));
Badge.displayName = 'Badge';
