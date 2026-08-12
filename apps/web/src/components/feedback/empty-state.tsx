import { type ReactNode } from 'react';

/** An empty screen is an invitation to act, not a dead end. */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-surface px-6 py-14 text-center">
      <h2 className="font-display text-lg font-medium">{title}</h2>
      <div className="max-w-md text-sm text-fg-muted">{children}</div>
    </div>
  );
}
