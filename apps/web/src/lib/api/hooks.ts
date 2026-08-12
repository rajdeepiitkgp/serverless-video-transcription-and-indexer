'use client';

import {
  type SearchResponse,
  searchResponseSchema,
  type StatsResponse,
  statsResponseSchema,
  type TranscriptResponse,
  transcriptResponseSchema,
  type VideoDetail,
  videoDetailSchema,
} from '@vidx/shared';
import { useCallback, useEffect, useState } from 'react';
import type * as z from 'zod';

import { type ApiRequestError, fetchApi, toApiRequestError } from '@/lib/api/client';

export type ApiQueryState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ApiRequestError }
  | { status: 'success'; data: T };

/** Query state plus the "Try again" affordance — error states are never dead ends. */
export type ApiQuery<T> = ApiQueryState<T> & { refetch: () => void };

/**
 * Minimal fetch-on-mount query hook. `path: null` means "not ready to fetch" (e.g. the
 * page is still reading its query string). Aborts in-flight requests on unmount.
 * `refetch` re-runs the current path, showing `loading` while it's in flight.
 */
export function useApiQuery<T extends z.ZodType>(
  path: string | null,
  dataSchema: T,
): ApiQuery<z.output<T>> {
  type Settled =
    { status: 'error'; error: ApiRequestError } | { status: 'success'; data: z.output<T> };
  // Only settled results are stored; idle/loading are derived from `path` below, and a
  // result stamped with a stale path or epoch is ignored, so no state reset is needed.
  const [settled, setSettled] = useState<{ key: string; result: Settled } | null>(null);
  const [epoch, setEpoch] = useState(0);

  const refetch = useCallback(() => {
    setEpoch((value) => value + 1);
  }, []);

  useEffect(() => {
    if (path === null) {
      return;
    }
    const key = `${String(epoch)}:${path}`;
    const controller = new AbortController();
    fetchApi(path, dataSchema, { signal: controller.signal })
      .then((data) => {
        setSettled({ key, result: { status: 'success', data } });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSettled({ key, result: { status: 'error', error: toApiRequestError(error) } });
        }
      });
    return () => {
      controller.abort();
    };
    // Schemas are module-level constants; `path` and `epoch` are the real dependencies.
  }, [path, dataSchema, epoch]);

  if (path === null) {
    return { status: 'idle', refetch };
  }
  const key = `${String(epoch)}:${path}`;
  return settled !== null && settled.key === key
    ? { ...settled.result, refetch }
    : { status: 'loading', refetch };
}

/** GET /api/videos/{id} — full metadata, insights, playback SAS, captions URL. */
export function useVideoDetail(id: string | null): ApiQuery<VideoDetail> {
  return useApiQuery(
    id === null ? null : `/api/videos/${encodeURIComponent(id)}`,
    videoDetailSchema,
  );
}

/** GET /api/videos/{id}/transcript — timestamped transcript lines. */
export function useTranscript(id: string | null): ApiQuery<TranscriptResponse> {
  return useApiQuery(
    id === null ? null : `/api/videos/${encodeURIComponent(id)}/transcript`,
    transcriptResponseSchema,
  );
}

/** GET /api/stats — dashboard aggregates (plan §4). */
export function useStats(): ApiQuery<StatsResponse> {
  return useApiQuery('/api/stats', statsResponseSchema);
}

/** GET /api/search?q= — matches with timestamps for search-to-seek (plan §4). */
export function useSearchResults(query: string | null): ApiQuery<SearchResponse> {
  return useApiQuery(
    query === null || query === '' ? null : `/api/search?q=${encodeURIComponent(query)}`,
    searchResponseSchema,
  );
}
