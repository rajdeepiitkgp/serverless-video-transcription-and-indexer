import { type VideoStatus } from '@vidx/shared';

import { cn } from '@/lib/cn';

interface Stage {
  label: string;
  dot: string;
  text: string;
  pulse?: boolean;
}

/**
 * Per-video stage timeline (plan §4): `Uploaded → Indexing → Processed`, joined by
 * scanline rules. Passed stages go quiet, the active stage wears its status hue,
 * and a failure replaces the stage it died in — a failed run never reaches
 * `Processed`, so that slot stays dark.
 */
const STAGES: Record<VideoStatus, Stage[]> = {
  Uploaded: [
    { label: 'UPLOADED', dot: 'bg-status-idle', text: 'text-status-idle' },
    { label: 'INDEXING', dot: 'bg-line-strong', text: 'text-fg-faint' },
    { label: 'PROCESSED', dot: 'bg-line-strong', text: 'text-fg-faint' },
  ],
  Indexing: [
    { label: 'UPLOADED', dot: 'bg-fg-faint', text: 'text-fg-faint' },
    { label: 'INDEXING', dot: 'bg-status-busy', text: 'text-status-busy', pulse: true },
    { label: 'PROCESSED', dot: 'bg-line-strong', text: 'text-fg-faint' },
  ],
  Processed: [
    { label: 'UPLOADED', dot: 'bg-fg-faint', text: 'text-fg-faint' },
    { label: 'INDEXING', dot: 'bg-fg-faint', text: 'text-fg-faint' },
    { label: 'PROCESSED', dot: 'bg-status-ok', text: 'text-status-ok' },
  ],
  Failed: [
    { label: 'UPLOADED', dot: 'bg-fg-faint', text: 'text-fg-faint' },
    { label: 'FAILED', dot: 'bg-status-err', text: 'text-status-err' },
    { label: 'PROCESSED', dot: 'bg-line-strong', text: 'text-fg-faint' },
  ],
};

export function StageTimeline({
  status,
  className,
}: {
  status: VideoStatus;
  className?: string;
}): React.JSX.Element {
  return (
    <ol className={cn('flex items-center gap-2', className)} aria-label={`Stage: ${status}`}>
      {STAGES[status].map((stage, index) => (
        <li key={stage.label} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden className="scanline w-4 sm:w-6" />}
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full',
                stage.dot,
                stage.pulse === true && 'motion-safe:animate-signal-pulse',
              )}
            />
            <span className={cn('font-mono text-xs tracking-wide', stage.text)}>{stage.label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
