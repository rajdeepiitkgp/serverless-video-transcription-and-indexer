'use client';

import { type StatsResponse, type VideoSummary } from '@vidx/shared';
import Link from 'next/link';

import { StatTile } from '@/components/dashboard/stat-tile';
import { StatusStrip } from '@/components/dashboard/status-strip';
import { VU_SEGMENTS, VuMeter } from '@/components/dashboard/vu-meter';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { Section } from '@/components/layout/section';
import { Button } from '@/components/ui/button';
import { WaveformProgress } from '@/components/upload/waveform-progress';
import { StageTimeline } from '@/components/video/stage-timeline';
import { useStats } from '@/lib/api/hooks';
import { formatTimecode } from '@/lib/timecode';
import { type UploadItem, useUploads } from '@/lib/uploads/uploads-provider';
import { useVideosLive } from '@/lib/videos/videos-live';

/** VI's monthly free indexing allowance (plan §12: 10 free hours). */
const VI_FREE_MINUTES_PER_MONTH = 600;

const RECENT_ROWS = 6;

const PHASE_LABELS: Record<UploadItem['phase'], string> = {
  requesting: 'REQUESTING SLOT…',
  'awaiting-confirmation': 'AWAITING CONFIRMATION',
  uploading: 'UPLOADING',
  done: 'UPLOADED',
  failed: 'FAILED',
};

const formatDate = (iso: string | undefined): string | null =>
  iso === undefined
    ? null
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(iso),
      );

function StatTiles({ stats }: { stats: StatsResponse }): React.JSX.Element {
  const processedPercent = Math.round(stats.processedRate * 100);
  const minutesShare = stats.minutesIndexedThisMonth / VI_FREE_MINUTES_PER_MONTH;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile
        label="TOTAL FOOTAGE"
        value={String(stats.totalVideos)}
        detail={
          stats.statusCounts.Indexing > 0
            ? `${String(stats.statusCounts.Indexing)} indexing now`
            : 'nothing in flight'
        }
      />
      <StatTile
        label="PROCESSED"
        value={String(processedPercent)}
        unit="%"
        meter={<VuMeter tone="ok" filled={stats.processedRate * VU_SEGMENTS} />}
        detail={`${String(stats.statusCounts.Processed)} of ${String(stats.totalVideos)}`}
      />
      <StatTile
        label="FAILED"
        value={String(stats.statusCounts.Failed)}
        tone={stats.statusCounts.Failed > 0 ? 'err' : 'default'}
        detail={stats.statusCounts.Failed > 0 ? 'open the library to inspect' : 'all clear'}
      />
      <StatTile
        label="AVG INDEX TIME"
        value={stats.avgIndexingSeconds === null ? '—' : formatTimecode(stats.avgIndexingSeconds)}
        detail={stats.avgIndexingSeconds === null ? 'no completed runs yet' : 'upload to processed'}
      />
      <StatTile
        label="MINUTES INDEXED"
        value={String(Math.round(stats.minutesIndexedThisMonth))}
        unit="min"
        meter={<VuMeter tone="scale" filled={minutesShare * VU_SEGMENTS} />}
        detail={`of ${String(VI_FREE_MINUTES_PER_MONTH)} free this month`}
      />
    </div>
  );
}

function TileSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-live="polite" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <span className="sr-only">Loading stats</span>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className="h-28 rounded-md bg-surface motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

function UploadRow({ upload }: { upload: UploadItem }): React.JSX.Element {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-accent-solid/40 bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{upload.fileName}</p>
        <p className="mt-0.5 font-mono text-xs text-accent">
          {PHASE_LABELS[upload.phase]}
          {upload.phase === 'uploading' && ` ${String(Math.round(upload.progress * 100))}%`}
        </p>
      </div>
      <WaveformProgress
        fraction={upload.progress}
        label={`Upload progress for ${upload.fileName}`}
        className="shrink-0"
      />
    </li>
  );
}

function VideoRow({ video }: { video: VideoSummary }): React.JSX.Element {
  const date = formatDate(video.submittedAt);
  return (
    <li className="flex flex-col gap-2 rounded-md border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <Link
          href={`/videos/watch/?id=${encodeURIComponent(video.id)}`}
          className="block truncate text-sm font-medium transition-colors duration-150 hover:text-accent"
        >
          {video.name}
        </Link>
        <p className="mt-0.5 truncate font-mono text-xs text-fg-faint">
          {video.uploadedBy.userDetails}
          {date !== null && ` · ${date}`}
        </p>
      </div>
      <StageTimeline status={video.status} className="shrink-0" />
    </li>
  );
}

/** The console home (plan §4 dashboard): VU tiles, pipeline strip, live deck. */
export function DashboardView(): React.JSX.Element {
  const stats = useStats();
  const { state: videosState, refetch } = useVideosLive();
  const { uploads } = useUploads();

  const liveUploads = uploads.filter(
    (upload) => upload.phase !== 'done' && upload.phase !== 'failed',
  );

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-widest text-accent">SIGNAL / CONSOLE</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Console</h1>
        <p className="max-w-xl text-sm text-fg-muted">
          What the pipeline is doing with your footage right now.
        </p>
      </header>

      {stats.status === 'error' ? (
        <ErrorPanel title="Couldn't load the stats" error={stats.error} onRetry={stats.refetch} />
      ) : stats.status === 'success' ? (
        <div className="flex flex-col gap-10">
          <StatTiles stats={stats.data} />
          <Section title="PIPELINE">
            <StatusStrip counts={stats.data.statusCounts} />
          </Section>
        </div>
      ) : (
        <TileSkeleton />
      )}

      <Section title="ON THE DECK">
        {videosState.status === 'error' ? (
          <ErrorPanel
            title="Couldn't load the library"
            error={videosState.error}
            onRetry={refetch}
          />
        ) : videosState.status === 'success' ? (
          videosState.videos.length === 0 && liveUploads.length === 0 ? (
            <EmptyState title="No footage logged yet">
              <p>Upload a video and the pipeline takes it from there.</p>
              <div className="mt-4">
                <Button asChild size="sm">
                  <Link href="/upload/">Upload video</Link>
                </Button>
              </div>
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {liveUploads.map((upload) => (
                <UploadRow key={upload.key} upload={upload} />
              ))}
              {videosState.videos.slice(0, RECENT_ROWS).map((video) => (
                <VideoRow key={video.id} video={video} />
              ))}
            </ul>
          )
        ) : (
          <div role="status" aria-live="polite" className="flex flex-col gap-2">
            <span className="sr-only">Loading the library</span>
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                aria-hidden
                className="h-16 rounded-md bg-surface motion-safe:animate-pulse"
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
