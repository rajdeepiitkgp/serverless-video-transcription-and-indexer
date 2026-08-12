'use client';

import {
  type TranscriptResponse,
  transcriptResponseSchema,
  type VideoDetail,
  videoDetailSchema,
} from '@vidx/shared';
import { useEffect, useState } from 'react';
import type * as z from 'zod';

import { type ApiRequestError, fetchApi, toApiRequestError } from '@/lib/api/client';

export type ApiQueryState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ApiRequestError }
  | { status: 'success'; data: T };

/**
 * Minimal fetch-on-mount query hook. `path: null` means "not ready to fetch" (e.g. the
 * page is still reading its query string). Aborts in-flight requests on unmount.
 */
export function useApiQuery<T extends z.ZodType>(
  path: string | null,
  dataSchema: T,
): ApiQueryState<z.output<T>> {
  type Settled =
    { status: 'error'; error: ApiRequestError } | { status: 'success'; data: z.output<T> };
  // Only settled results are stored; idle/loading are derived from `path` below, and a
  // result stamped with a stale path is ignored, so no state reset is ever needed.
  const [settled, setSettled] = useState<{ path: string; result: Settled } | null>(null);

  useEffect(() => {
    if (path === null) {
      return;
    }
    const controller = new AbortController();
    fetchApi(path, dataSchema, { signal: controller.signal })
      .then((data) => {
        setSettled({ path, result: { status: 'success', data } });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSettled({ path, result: { status: 'error', error: toApiRequestError(error) } });
        }
      });
    return () => {
      controller.abort();
    };
    // Schemas are module-level constants; `path` is the real dependency.
  }, [path, dataSchema]);

  if (path === null) {
    return { status: 'idle' };
  }
  return settled !== null && settled.path === path ? settled.result : { status: 'loading' };
}

/** GET /api/videos/{id} — full metadata, insights, playback SAS, captions URL. */
export function useVideoDetail(id: string | null): ApiQueryState<VideoDetail> {
  return useApiQuery(
    id === null ? null : `/api/videos/${encodeURIComponent(id)}`,
    videoDetailSchema,
  );
}

/** GET /api/videos/{id}/transcript — timestamped transcript lines. */
export function useTranscript(id: string | null): ApiQueryState<TranscriptResponse> {
  return useApiQuery(
    id === null ? null : `/api/videos/${encodeURIComponent(id)}/transcript`,
    transcriptResponseSchema,
  );
}
