'use client';

import { Button } from '@/components/ui/button';

/** Global error boundary (plan §4/§6) — plain words, a way back, nothing leaked. */
export default function ErrorBoundary({ reset }: { reset: () => void }): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-md border border-status-err/40 bg-surface px-6 py-14 text-center"
    >
      <h2 className="font-display text-lg font-medium text-status-err">Something went wrong</h2>
      <p className="max-w-md text-sm text-fg-muted">
        The console hit an unexpected error. Reload the page, and contact support if it keeps
        happening.
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          reset();
        }}
      >
        Try again
      </Button>
    </div>
  );
}
