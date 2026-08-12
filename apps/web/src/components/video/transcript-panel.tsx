'use client';

import { type TranscriptLine } from '@vidx/shared';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { formatTimecode } from '@/lib/timecode';

interface TranscriptPanelProps {
  lines: readonly TranscriptLine[];
  currentSeconds: number;
  onSeek: (seconds: number) => void;
  emptyMessage: string;
}

const activeLineIndex = (lines: readonly TranscriptLine[], currentSeconds: number): number =>
  lines.findIndex(
    (line) => currentSeconds >= line.startSeconds && currentSeconds < line.endSeconds,
  );

/**
 * The signature element of the watch page: a log-sheet transcript deck. Timecode
 * gutter in mono, the current line marked by an amber playhead rail, click-to-seek
 * on every line (plan §4).
 */
export function TranscriptPanel({
  lines,
  currentSeconds,
  onSeek,
  emptyMessage,
}: TranscriptPanelProps): React.JSX.Element {
  const [follow, setFollow] = useState(true);
  const activeRef = useRef<HTMLLIElement | null>(null);
  const activeIndex = activeLineIndex(lines, currentSeconds);

  useEffect(() => {
    if (!follow || activeRef.current === null) {
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeRef.current.scrollIntoView({
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeIndex, follow]);

  return (
    <section
      aria-label="Transcript"
      className="flex min-h-0 flex-col rounded-md border border-line bg-surface"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-xs font-medium tracking-widest text-fg-muted">TRANSCRIPT</h2>
        {lines.length > 0 && (
          <button
            type="button"
            aria-pressed={follow}
            onClick={() => {
              setFollow((value) => !value);
            }}
            className={cn(
              'cursor-pointer rounded-xs border px-2 py-0.5 font-mono text-xs transition-colors duration-150',
              follow
                ? 'border-accent-solid/40 bg-accent-solid/10 text-accent'
                : 'border-line text-fg-faint hover:text-fg',
            )}
          >
            FOLLOW
          </button>
        )}
      </header>

      {lines.length === 0 ? (
        <p className="px-4 py-6 text-sm text-fg-muted">{emptyMessage}</p>
      ) : (
        <ol className="min-h-0 flex-1 overflow-y-auto py-1">
          {lines.map((line, index) => {
            const active = index === activeIndex;
            return (
              <li
                key={`${String(line.startSeconds)}-${String(index)}`}
                ref={active ? activeRef : null}
              >
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => {
                    onSeek(line.startSeconds);
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-baseline gap-3 border-l-2 border-transparent px-4 py-1.5 text-left transition-colors duration-150 hover:bg-raised',
                    active && 'border-accent-solid bg-accent-solid/10',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 font-mono text-xs tracking-tight',
                      active ? 'text-accent' : 'text-fg-faint',
                    )}
                  >
                    {formatTimecode(line.startSeconds)}
                  </span>
                  <span className={cn('text-sm', active ? 'text-fg' : 'text-fg-muted')}>
                    {line.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
