'use client';

import { deleteResponseSchema, type VideoSummary } from '@vidx/shared';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { VideoCard } from '@/components/library/video-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { describeApiError, fetchApi } from '@/lib/api/client';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useVideosLive } from '@/lib/videos/videos-live';

/** Library page body (plan §4): film-frame grid over the shared live list. */
export function LibraryView(): React.JSX.Element {
  const { state, refetch } = useVideosLive();
  const { status: userStatus, user } = useCurrentUser();
  const [target, setTarget] = useState<VideoSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = (video: VideoSummary): boolean =>
    userStatus === 'signed-in' &&
    (user.userRoles.includes('admin') || user.userId === video.uploadedBy.userId);

  const confirmDelete = (): void => {
    if (target === null) {
      return;
    }
    setDeleting(true);
    fetchApi(`/api/videos/${encodeURIComponent(target.id)}`, deleteResponseSchema, {
      method: 'DELETE',
    })
      .then(() => {
        toast.success(`Deleted — ${target.name}`);
        refetch();
      })
      .catch((cause: unknown) => {
        toast.error(`Couldn't delete ${target.name}`, { description: describeApiError(cause) });
      })
      .finally(() => {
        setDeleting(false);
        setTarget(null);
      });
  };

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-widest text-accent">SIGNAL / LIBRARY</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Library</h1>
        <p className="max-w-xl text-sm text-fg-muted">
          Everything the pipeline has logged. Open a video to watch it, scrub the transcript, and
          download the source or subtitles.
        </p>
      </header>

      {state.status === 'error' ? (
        <ErrorPanel title="Couldn't load the library" error={state.error} onRetry={refetch} />
      ) : state.status === 'success' ? (
        state.videos.length === 0 ? (
          <EmptyState title="No footage in the library">
            <p>Upload a video and it appears here as soon as the slot is issued.</p>
            <div className="mt-4">
              <Button asChild size="sm">
                <Link href="/upload/">Upload video</Link>
              </Button>
            </div>
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                canDelete={canDelete(video)}
                onDelete={setTarget}
              />
            ))}
          </ul>
        )
      ) : (
        <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">Loading the library</span>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              aria-hidden
              className="aspect-4/3 rounded-md bg-surface motion-safe:animate-pulse"
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete {target?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the source video from storage, every extracted insight and
            transcript, and the library record. There's no undo.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="ghost" disabled={deleting}>
                Keep it
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={(event) => {
                  // Radix closes on action by default; stay open while the DELETE runs.
                  event.preventDefault();
                  confirmDelete();
                }}
              >
                {deleting ? 'Deleting…' : 'Delete video'}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
