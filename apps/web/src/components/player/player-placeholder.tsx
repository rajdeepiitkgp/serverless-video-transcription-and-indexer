import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface PlayerPlaceholderProps {
  title: string;
  children: ReactNode;
  tone?: 'neutral' | 'busy' | 'error';
}

const TONE_STYLES = {
  neutral: 'text-fg-muted',
  busy: 'text-status-busy',
  error: 'text-status-err',
} as const;

/**
 * Stands in for the player when there is nothing to play yet (still indexing), the
 * pipeline failed, or the format can't be previewed in the browser (plan §4).
 */
export function PlayerPlaceholder({
  title,
  children,
  tone = 'neutral',
}: PlayerPlaceholderProps): React.JSX.Element {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-md border border-line bg-surface px-6 text-center">
      <span
        aria-hidden
        className={cn(
          'size-2 rounded-full bg-current',
          tone === 'busy' && 'motion-safe:animate-signal-pulse',
          TONE_STYLES[tone],
        )}
      />
      <h2 className={cn('font-display text-lg font-medium', TONE_STYLES[tone])}>{title}</h2>
      <div className="max-w-md text-sm text-fg-muted">{children}</div>
    </div>
  );
}
