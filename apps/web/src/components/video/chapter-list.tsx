'use client';

import { type Chapter } from '@vidx/shared';

import { cn } from '@/lib/cn';
import { formatTimecode } from '@/lib/timecode';

interface ChapterListProps {
  chapters: readonly Chapter[];
  currentSeconds: number;
  onSeek: (seconds: number) => void;
}

/** Chapters derived from VI topics/scenes; numbering reflects real playback order. */
export function ChapterList({
  chapters,
  currentSeconds,
  onSeek,
}: ChapterListProps): React.JSX.Element | null {
  if (chapters.length === 0) {
    return null;
  }
  // The active chapter is the last one whose start has been passed.
  const activeIndex = chapters.findLastIndex((chapter) => currentSeconds >= chapter.startSeconds);

  return (
    <section aria-label="Chapters">
      <h2 className="mb-2 font-mono text-xs font-medium tracking-widest text-fg-muted">CHAPTERS</h2>
      <ol className="flex flex-col gap-1">
        {chapters.map((chapter, index) => {
          const active = index === activeIndex;
          return (
            <li key={`${String(chapter.startSeconds)}-${String(index)}`}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  onSeek(chapter.startSeconds);
                }}
                className={cn(
                  'flex w-full cursor-pointer items-baseline gap-3 rounded-sm border border-transparent px-2 py-1.5 text-left transition-colors duration-150 hover:bg-raised',
                  active && 'border-line bg-surface',
                )}
              >
                <span
                  className={cn(
                    'shrink-0 font-mono text-xs',
                    active ? 'text-accent' : 'text-fg-faint',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={cn('flex-1 text-sm', active ? 'text-fg' : 'text-fg-muted')}>
                  {chapter.title}
                </span>
                <span className="shrink-0 font-mono text-xs tracking-tight text-fg-faint">
                  {formatTimecode(chapter.startSeconds)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
