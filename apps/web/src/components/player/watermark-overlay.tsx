'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

const POSITIONS = [
  'top-4 left-4',
  'top-4 right-4',
  'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'bottom-8 left-4',
  'bottom-8 right-4',
] as const;

export const WATERMARK_INTERVAL_MS = 25_000;

/**
 * Forensic watermark (plan §4): the signed-in user's email at low opacity,
 * repositioned periodically so a cropped capture stays attributable. Deterrence and
 * attribution — honestly not DRM.
 */
export function WatermarkOverlay({ label }: { label: string }): React.JSX.Element {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPosition((value) => (value + 1) % POSITIONS.length);
    }, WATERMARK_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 select-none">
      <span
        data-testid="watermark"
        className={cn(
          'absolute font-mono text-xs text-white/40 drop-shadow-sm',
          POSITIONS[position],
        )}
      >
        {label}
      </span>
    </div>
  );
}
