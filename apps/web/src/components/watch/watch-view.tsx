'use client';

import { type TranscriptLine, type VideoDetail } from '@vidx/shared';
import { useRef, useState } from 'react';

import { PlayerPlaceholder } from '@/components/player/player-placeholder';
import { VideoPlayer, type VideoPlayerHandle } from '@/components/player/video-player';
import { Badge } from '@/components/ui/badge';
import { ChapterList } from '@/components/video/chapter-list';
import { StatusChip } from '@/components/video/status-chip';
import { Timecode } from '@/components/video/timecode';
import { TranscriptPanel } from '@/components/video/transcript-panel';
import { DownloadActions } from '@/components/watch/download-actions';
import { type ApiQueryState } from '@/lib/api/hooks';

interface WatchViewProps {
  detail: VideoDetail;
  transcriptState: ApiQueryState<{ lines: TranscriptLine[] }>;
  /** Signed-in user's email for the forensic watermark; null while unknown. */
  watermark: string | null;
  /** Deep-link start position from `?t=` (search-to-seek, plan §4). */
  initialSeconds?: number;
}

function PlayerRegion({
  detail,
  watermark,
  initialSeconds,
  onTimeUpdate,
  playerRef,
}: {
  detail: VideoDetail;
  watermark: string | null;
  initialSeconds?: number;
  onTimeUpdate: (seconds: number) => void;
  playerRef: React.Ref<VideoPlayerHandle>;
}): React.JSX.Element {
  if (!detail.playable) {
    return (
      <PlayerPlaceholder title="This format can't be previewed in the browser">
        The source file isn't browser-playable (AVI, MKV, WMV, …). The transcript, insights, and
        search all still work — download the original below to watch it locally.
      </PlayerPlaceholder>
    );
  }
  if (detail.playbackUrl !== null) {
    return (
      <VideoPlayer
        ref={playerRef}
        src={detail.playbackUrl}
        captionsUrl={detail.captionsUrl}
        chapters={detail.chapters}
        watermark={watermark}
        {...(initialSeconds === undefined ? {} : { initialSeconds })}
        onTimeUpdate={onTimeUpdate}
      />
    );
  }
  switch (detail.status) {
    case 'Uploaded':
      return (
        <PlayerPlaceholder title="Queued for indexing">
          This footage was just logged. Indexing starts automatically — playback and the transcript
          appear once it completes.
        </PlayerPlaceholder>
      );
    case 'Indexing':
      return (
        <PlayerPlaceholder title="Indexing in progress" tone="busy">
          The signal is being extracted. Playback, captions, and the transcript appear when indexing
          completes.
        </PlayerPlaceholder>
      );
    case 'Failed':
      return (
        <PlayerPlaceholder title="Indexing failed" tone="error">
          {detail.error ?? 'The pipeline could not process this video.'}
        </PlayerPlaceholder>
      );
    case 'Processed':
      return (
        <PlayerPlaceholder title="Playback unavailable">
          The playback link couldn't be issued. Reload the page to request a fresh one.
        </PlayerPlaceholder>
      );
  }
}

const transcriptEmptyMessage = (
  detail: VideoDetail,
  transcriptState: WatchViewProps['transcriptState'],
): string => {
  if (transcriptState.status === 'loading' || transcriptState.status === 'idle') {
    return 'Loading transcript…';
  }
  if (transcriptState.status === 'error') {
    const { error } = transcriptState;
    return error.trackingId === null
      ? error.message
      : `${error.message} (support ID ${error.trackingId})`;
  }
  switch (detail.status) {
    case 'Processed':
      return 'No speech was detected in this footage.';
    case 'Failed':
      return 'Indexing failed before a transcript was produced.';
    default:
      return 'The transcript appears when indexing completes.';
  }
};

/** The watch page body: player + metadata + insights on the left, transcript deck right. */
export function WatchView({
  detail,
  transcriptState,
  watermark,
  initialSeconds,
}: WatchViewProps): React.JSX.Element {
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const [currentSeconds, setCurrentSeconds] = useState(initialSeconds ?? 0);

  const seekTo = (seconds: number): void => {
    playerRef.current?.seekTo(seconds);
    setCurrentSeconds(seconds);
  };

  const lines = transcriptState.status === 'success' ? transcriptState.data.lines : [];
  const submittedAt =
    detail.submittedAt === undefined
      ? null
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(detail.submittedAt),
        );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
        <PlayerRegion
          detail={detail}
          watermark={watermark}
          {...(initialSeconds === undefined ? {} : { initialSeconds })}
          onTimeUpdate={setCurrentSeconds}
          playerRef={playerRef}
        />

        <header>
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip status={detail.status} />
            {detail.durationInSeconds !== undefined && (
              <Timecode seconds={detail.durationInSeconds} />
            )}
            {!detail.playable && <Badge variant="outline">PREVIEW UNAVAILABLE</Badge>}
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight">{detail.name}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Uploaded by {detail.uploadedBy.userDetails}
            {submittedAt !== null && <> · {submittedAt}</>}
          </p>
        </header>

        <div className="scanline" role="presentation" />

        <ChapterList chapters={detail.chapters} currentSeconds={currentSeconds} onSeek={seekTo} />

        {(detail.keywords.length > 0 || detail.topics.length > 0) && (
          <section aria-label="Insights" className="flex flex-col gap-3">
            {detail.keywords.length > 0 && (
              <div>
                <h2 className="mb-2 font-mono text-xs font-medium tracking-widest text-fg-muted">
                  KEYWORDS
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {detail.keywords.map((keyword) => (
                    <Badge key={keyword}>{keyword}</Badge>
                  ))}
                </div>
              </div>
            )}
            {detail.topics.length > 0 && (
              <div>
                <h2 className="mb-2 font-mono text-xs font-medium tracking-widest text-fg-muted">
                  TOPICS
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {detail.topics.map((topic) => (
                    <Badge key={topic} variant="accent">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <DownloadActions videoId={detail.id} hasTranscript={lines.length > 0} />
      </div>

      {/* h-[32rem]: the deck needs a fixed viewport so its line list can scroll;
          Tailwind's spacing scale tops out at h-96. */}
      <div className="h-[32rem] lg:sticky lg:top-6 lg:h-[calc(100dvh-6rem)]">
        <TranscriptPanel
          lines={lines}
          currentSeconds={currentSeconds}
          onSeek={seekTo}
          emptyMessage={transcriptEmptyMessage(detail, transcriptState)}
        />
      </div>
    </div>
  );
}
