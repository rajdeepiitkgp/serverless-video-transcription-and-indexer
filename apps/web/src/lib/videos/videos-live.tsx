'use client';

import { type VideoStatus, type VideoSummary, videoSummarySchema } from '@vidx/shared';
import { useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

import { type ApiRequestError, fetchApi, toApiRequestError } from '@/lib/api/client';

const videoListSchema = z.object({ videos: z.array(videoSummarySchema) });

/**
 * Library refresh cadence. Fast enough that a completion toast lands while the
 * moment is still relevant; slow enough to stay a rounding error in RU/execution
 * cost. Polling pauses while the tab is hidden.
 */
export const VIDEOS_POLL_INTERVAL_MS = 15_000;

export type VideosLiveState =
  | { status: 'loading' }
  | { status: 'error'; error: ApiRequestError }
  | { status: 'success'; videos: VideoSummary[] };

export interface VideosLive {
  state: VideosLiveState;
  /** Immediate reload — used after uploads land and deletes complete. */
  refetch: () => void;
}

const VideosLiveContext = createContext<VideosLive | null>(null);

/**
 * The status poller behind the whole console (plan §4): one `GET /api/videos` loop
 * feeds the dashboard and library, and diffing consecutive results drives the
 * completion toasts — when a video flips to `Processed`/`Failed` while you're
 * anywhere in the app, a toast announces it with a jump-to-watch action.
 */
export function VideosLiveProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<VideosLiveState>({ status: 'loading' });
  const knownStatuses = useRef<Map<string, VideoStatus> | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const announce = useCallback(
    (video: VideoSummary): void => {
      const watch = {
        label: 'Watch',
        onClick: () => {
          router.push(`/videos/watch/?id=${encodeURIComponent(video.id)}`);
        },
      };
      if (video.status === 'Processed') {
        toast.success(`Processed — ${video.name}`, {
          description: 'Transcript and insights are ready.',
          action: watch,
        });
      } else {
        toast.error(`Indexing failed — ${video.name}`, {
          description: 'Open it for the failure details.',
          action: watch,
        });
      }
    },
    [router],
  );

  const load = useCallback((): void => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    fetchApi('/api/videos', videoListSchema, { signal: controller.signal })
      .then(({ videos }) => {
        const previous = knownStatuses.current;
        if (previous !== null) {
          for (const video of videos) {
            const before = previous.get(video.id);
            const flipped = before !== undefined && before !== video.status;
            if (flipped && (video.status === 'Processed' || video.status === 'Failed')) {
              announce(video);
            }
          }
        }
        knownStatuses.current = new Map(videos.map((video) => [video.id, video.status]));
        setState({ status: 'success', videos });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        // A transient blip mid-session shouldn't blank an already-rendered library;
        // only surface errors while there's nothing better to show.
        setState((current) =>
          current.status === 'success'
            ? current
            : { status: 'error', error: toApiRequestError(error) },
        );
      });
  }, [announce]);

  useEffect(() => {
    load();
    const tick = (): void => {
      if (!document.hidden) {
        load();
      }
    };
    const interval = setInterval(tick, VIDEOS_POLL_INTERVAL_MS);
    // Refresh immediately when the tab comes back — the poller slept while hidden.
    const onVisible = (): void => {
      if (!document.hidden) {
        load();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      inFlight.current?.abort();
    };
  }, [load]);

  return (
    <VideosLiveContext.Provider value={{ state, refetch: load }}>
      {children}
    </VideosLiveContext.Provider>
  );
}

export function useVideosLive(): VideosLive {
  const context = useContext(VideosLiveContext);
  if (context === null) {
    throw new Error('useVideosLive requires a VideosLiveProvider ancestor.');
  }
  return context;
}
