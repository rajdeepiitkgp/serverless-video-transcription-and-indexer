import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HealthIndicator } from '@/components/layout/health-indicator';

const healthResponse = (status: string): Response =>
  new Response(JSON.stringify({ data: { status } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HealthIndicator', () => {
  it('shows OK when the API answers ok', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(healthResponse('ok')));
    render(<HealthIndicator />);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('API OK');
    });
    expect(screen.getByRole('status').title).toMatch(/^Last checked/);
  });

  it('shows DEGRADED when the API says so', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(healthResponse('degraded')));
    render(<HealthIndicator />);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('API DEGRADED');
    });
  });

  it('reads an unreachable API as DOWN', async () => {
    // 400 is non-retryable, so the check settles immediately.
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('nope', { status: 400 })),
    );
    render(<HealthIndicator />);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('API DOWN');
    });
  });
});
