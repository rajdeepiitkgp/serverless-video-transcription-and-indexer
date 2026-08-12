import { type VideoStatus } from '@vidx/shared';

import { cn } from '@/lib/cn';

/**
 * Status hues carry meaning (plan §4): amber pulse = indexing, green = processed,
 * red = failed, cold slate = footage that just arrived.
 */
const STATUS_STYLES: Record<VideoStatus, { text: string; dot: string }> = {
  Uploaded: { text: 'text-status-idle', dot: 'bg-status-idle' },
  Indexing: { text: 'text-status-busy', dot: 'bg-status-busy motion-safe:animate-signal-pulse' },
  Processed: { text: 'text-status-ok', dot: 'bg-status-ok' },
  Failed: { text: 'text-status-err', dot: 'bg-status-err' },
};

export function StatusChip({
  status,
  className,
}: {
  status: VideoStatus;
  className?: string;
}): React.JSX.Element {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xs border border-line bg-surface px-2 py-0.5 font-mono text-xs font-medium tracking-wide',
        styles.text,
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', styles.dot)} />
      {status.toUpperCase()}
    </span>
  );
}
