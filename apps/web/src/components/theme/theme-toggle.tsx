'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { cn } from '@/lib/cn';

const OPTIONS = [
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'system', label: 'Match system theme', Icon: Monitor },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
] as const;

const emptySubscribe = (): (() => void) => () => undefined;

/** Light / system / dark switch, rendered as an accessible radio group. */
export function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown until the client mounts (server HTML must match the
  // hydrated tree); this store reads false on the server, true after hydration.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="flex items-center rounded-sm border border-line bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            onClick={() => {
              setTheme(value);
            }}
            className={cn(
              'flex size-7 cursor-pointer items-center justify-center rounded-xs text-fg-faint transition-colors duration-150 hover:text-fg',
              selected && 'bg-raised text-accent',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
