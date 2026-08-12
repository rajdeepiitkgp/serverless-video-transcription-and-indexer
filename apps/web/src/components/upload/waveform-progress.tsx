import { cn } from '@/lib/cn';

/*
 * Waveform progress (the Signal motif for anything in motion): 30 fixed-height bars,
 * the played span in amber. Discrete bars mean progress renders from classes alone —
 * no inline width styles.
 */
const WAVEFORM_HEIGHTS = [
  'h-2',
  'h-4',
  'h-3',
  'h-6',
  'h-5',
  'h-3',
  'h-6',
  'h-4',
  'h-2',
  'h-5',
  'h-6',
  'h-3',
  'h-4',
  'h-6',
  'h-2',
  'h-5',
  'h-4',
  'h-6',
  'h-3',
  'h-5',
  'h-2',
  'h-4',
  'h-6',
  'h-5',
  'h-3',
  'h-4',
  'h-2',
  'h-6',
  'h-4',
  'h-3',
] as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function WaveformProgress({
  fraction,
  label,
  className,
}: {
  /** 0..1 */
  fraction: number;
  label: string;
  className?: string;
}): React.JSX.Element {
  const percent = Math.round(clamp01(fraction) * 100);
  const played = Math.round(clamp01(fraction) * WAVEFORM_HEIGHTS.length);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('flex h-6 items-center gap-0.5', className)}
    >
      {WAVEFORM_HEIGHTS.map((height, index) => (
        <span
          key={index}
          className={cn(
            'w-1 rounded-full',
            height,
            index < played ? 'bg-accent-solid' : 'bg-line-strong',
          )}
        />
      ))}
    </div>
  );
}
