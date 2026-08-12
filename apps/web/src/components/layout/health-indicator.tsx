'use client';

import { healthResponseSchema, type HealthStatus } from '@vidx/shared';
import { useEffect, useState } from 'react';

import { fetchApi } from '@/lib/api/client';
import { cn } from '@/lib/cn';

export const HEALTH_POLL_INTERVAL_MS = 60_000;

type IndicatorStatus = HealthStatus | 'unknown';

const DOT_STYLES: Record<IndicatorStatus, string> = {
  unknown: 'bg-status-idle',
  ok: 'bg-status-ok',
  degraded: 'bg-status-busy motion-safe:animate-signal-pulse',
  down: 'bg-status-err',
};

const TEXT_STYLES: Record<IndicatorStatus, string> = {
  unknown: 'text-fg-faint',
  ok: 'text-fg-muted',
  degraded: 'text-status-busy',
  down: 'text-status-err',
};

/**
 * Footer health dot fed by the anonymous `GET /api/health` (plan §4). An
 * unreachable API reads as `down` — from the console's side of the screen that's
 * the truth. Polling pauses while the tab is hidden.
 */
export function HealthIndicator(): React.JSX.Element {
  const [state, setState] = useState<{ status: IndicatorStatus; checkedAt: Date | null }>({
    status: 'unknown',
    checkedAt: null,
  });

  useEffect(() => {
    let disposed = false;
    const check = (): void => {
      fetchApi('/api/health', healthResponseSchema)
        .then(({ status }) => {
          if (!disposed) {
            setState({ status, checkedAt: new Date() });
          }
        })
        .catch(() => {
          if (!disposed) {
            setState({ status: 'down', checkedAt: new Date() });
          }
        });
    };
    check();
    const interval = setInterval(() => {
      if (!document.hidden) {
        check();
      }
    }, HEALTH_POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, []);

  const lastChecked =
    state.checkedAt === null
      ? 'Checking…'
      : `Last checked ${new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(state.checkedAt)}`;

  return (
    <span
      role="status"
      title={lastChecked}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-xs',
        TEXT_STYLES[state.status],
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT_STYLES[state.status])} />
      {state.status === 'unknown' ? 'API …' : `API ${state.status.toUpperCase()}`}
      <span className="sr-only">{lastChecked}</span>
    </span>
  );
}
