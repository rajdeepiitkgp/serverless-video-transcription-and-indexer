import { type ComponentProps } from 'react';

import { cn } from '@/lib/cn';

export function Input({ className, ...props }: ComponentProps<'input'>): React.JSX.Element {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-sm border border-line bg-canvas px-3 text-sm text-fg transition-colors duration-150 placeholder:text-fg-faint hover:border-line-strong disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
