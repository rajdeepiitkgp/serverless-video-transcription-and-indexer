import { cn } from '@/lib/cn';
import { formatTimecode } from '@/lib/timecode';

/** Everything time-coded is set in mono, tabular, like an edit deck (plan §4). */
export function Timecode({
  seconds,
  className,
}: {
  seconds: number;
  className?: string;
}): React.JSX.Element {
  return (
    <span className={cn('font-mono text-xs tracking-tight text-fg-muted', className)}>
      {formatTimecode(seconds)}
    </span>
  );
}
