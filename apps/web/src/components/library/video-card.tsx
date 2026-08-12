import { type VideoSummary } from '@vidx/shared';
import { Play, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/video/status-chip';
import { Timecode } from '@/components/video/timecode';

const formatDate = (iso: string | undefined): string | null =>
  iso === undefined
    ? null
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));

/**
 * Film-frame library card (the Signal motif for anything that holds footage).
 * The delete control only renders when the caller may actually delete — owners
 * their own uploads, admins anything (plan §4); the API enforces it regardless.
 */
export function VideoCard({
  video,
  canDelete,
  onDelete,
}: {
  video: VideoSummary;
  canDelete: boolean;
  onDelete: (video: VideoSummary) => void;
}): React.JSX.Element {
  const date = formatDate(video.submittedAt);
  return (
    <li className="film-frame">
      <div className="px-3">
        <Link href={`/videos/watch/?id=${encodeURIComponent(video.id)}`} className="group block">
          <div className="relative flex aspect-video items-center justify-center rounded-sm bg-raised">
            <Play
              aria-hidden
              className="size-8 text-fg-faint transition-colors duration-150 group-hover:text-accent"
            />
            {!video.playable && (
              <Badge variant="outline" className="absolute top-2 left-2 bg-canvas/80">
                PREVIEW UNAVAILABLE
              </Badge>
            )}
            {video.durationInSeconds !== undefined && (
              <span className="absolute right-2 bottom-2 rounded-xs bg-canvas/80 px-1.5 py-0.5">
                <Timecode seconds={video.durationInSeconds} className="text-fg" />
              </span>
            )}
          </div>
          <p className="mt-2 truncate text-sm font-medium transition-colors duration-150 group-hover:text-accent">
            {video.name}
          </p>
        </Link>
        <p className="mt-0.5 truncate font-mono text-xs text-fg-faint">
          {video.uploadedBy.userDetails}
          {date !== null && ` · ${date}`}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <StatusChip status={video.status} />
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-fg-faint hover:text-status-err"
              aria-label={`Delete ${video.name}`}
              onClick={() => {
                onDelete(video);
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
