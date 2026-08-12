import { type ApiRequestError } from '@/lib/api/client';

/**
 * Error surface for failed queries. Always shows the tracking ID when the API sent
 * one — "quote VXT-… to support" is the whole support loop (plan §6).
 */
export function ErrorPanel({
  title,
  error,
}: {
  title: string;
  error: ApiRequestError;
}): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-md border border-status-err/40 bg-surface px-6 py-10 text-center"
    >
      <h2 className="font-display text-lg font-medium text-status-err">{title}</h2>
      <p className="max-w-md text-sm text-fg-muted">{error.message}</p>
      {error.trackingId !== null && (
        <p className="text-sm text-fg-muted">
          Quote this ID to support:{' '}
          <code className="rounded-xs bg-raised px-1.5 py-0.5 font-mono text-xs text-accent">
            {error.trackingId}
          </code>
        </p>
      )}
    </div>
  );
}
