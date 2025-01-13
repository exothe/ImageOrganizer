import React from 'react';
import { Input } from './Input';

type InputProps = React.ComponentPropsWithoutRef<typeof Input>;

export const SuffixedInput = React.forwardRef<HTMLDivElement, InputProps>(
    ({ type, className, children, ...props }, ref) => {
        const childrenCount = React.Children.count(children);

        return (
            <div ref={ref} className="relative">
                <Input
                    type={type}
                    className={className}
                    style={{
                        paddingRight: `${childrenCount * 1.625}rem`,
                    }}
                    {...props}
                />
                <div className="absolute right-2 top-0 bottom-0 flex">{children}</div>
            </div>
        );
    },
);
SuffixedInput.displayName = 'SuffixedInput';
