'use client';

import { useTheme } from 'next-themes';
import { Toaster as SonnerToaster } from 'sonner';

/**
 * sonner, dressed in the console tokens (plan §4 interactive feedback). The
 * `group-[.toaster]:` prefixes out-rank sonner's own element styles, same trick as
 * shadcn's recipe.
 */
export function Toaster(): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group-[.toaster]:rounded-md group-[.toaster]:border-line group-[.toaster]:bg-overlay group-[.toaster]:text-fg group-[.toaster]:shadow-lg',
          title: 'group-[.toast]:text-sm group-[.toast]:font-medium',
          description: 'group-[.toast]:text-fg-muted',
          actionButton:
            'group-[.toast]:bg-accent-solid group-[.toast]:font-medium group-[.toast]:text-accent-solid-fg',
        },
      }}
    />
  );
}
