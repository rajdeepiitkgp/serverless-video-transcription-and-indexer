import { cn } from '@/lib/cn';

export const VU_SEGMENTS = 10;

/**
 * Ten-segment VU meter. `scale` colors by position (green → amber → red, the
 * hardware convention) for budget-style readings; `ok` keeps one hue for plain
 * share-of-total readings (sequential = one hue). Decorative next to its tile's
 * value + detail text, so it's hidden from the accessibility tree.
 */
export function VuMeter({
  filled,
  tone,
  className,
}: {
  /** Lit segments, 0..VU_SEGMENTS. */
  filled: number;
  tone: 'scale' | 'ok';
  className?: string;
}): React.JSX.Element {
  const lit = Math.min(VU_SEGMENTS, Math.max(0, Math.round(filled)));
  const litClass = (index: number): string => {
    if (tone === 'ok') {
      return 'bg-status-ok';
    }
    if (index < 6) {
      return 'bg-status-ok';
    }
    return index < 8 ? 'bg-status-busy' : 'bg-status-err';
  };
  return (
    <div aria-hidden className={cn('flex gap-1', className)}>
      {Array.from({ length: VU_SEGMENTS }, (_, index) => (
        <span
          key={index}
          className={cn('h-3 w-1.5 rounded-xs', index < lit ? litClass(index) : 'bg-line')}
        />
      ))}
    </div>
  );
}
