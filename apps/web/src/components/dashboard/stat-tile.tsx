import { type ReactNode } from 'react';

import { cn } from '@/lib/cn';

const VALUE_TONES = {
  default: 'text-fg',
  err: 'text-status-err',
} as const;

/** VU-meter stat tile (the style-tile motif): mono value, optional meter, quiet label. */
export function StatTile({
  label,
  value,
  unit,
  tone = 'default',
  meter,
  detail,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: keyof typeof VALUE_TONES;
  meter?: ReactNode;
  detail?: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
      <p className="font-mono text-xs text-fg-faint">{label}</p>
      <p className={cn('font-mono text-3xl font-semibold', VALUE_TONES[tone])}>
        {value}
        {unit !== undefined && <span className="ml-1 text-sm text-fg-muted">{unit}</span>}
      </p>
      {meter}
      {detail !== undefined && <p className="text-xs text-fg-muted">{detail}</p>}
    </div>
  );
}
