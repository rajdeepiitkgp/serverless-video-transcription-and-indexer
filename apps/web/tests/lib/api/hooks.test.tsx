import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

import { useApiQuery } from '@/lib/api/hooks';

const dataSchema = z.object({ value: z.string() });

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useApiQuery', () => {
  it('is idle for a null path', () => {
    const { result } = renderHook(() => useApiQuery(null, dataSchema));
    expect(result.current.status).toBe('idle');
  });

  it('loads and settles into success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { value: 'ok' } })),
    );
    const { result } = renderHook(() => useApiQuery('/api/test', dataSchema));
    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
  });

  it('refetch turns an error into a fresh attempt', async () => {
    // 404 is deliberately non-retryable, so the failure settles immediately.
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'nope' }, 404))
      .mockResolvedValueOnce(jsonResponse({ data: { value: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useApiQuery('/api/test', dataSchema));
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    result.current.refetch();
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
