import { type Chapter } from '@vidx/shared';

import { formatVttTimestamp } from '@/lib/timecode';

/** Cue text must stay a single line and must never contain a cue-timing arrow. */
const sanitizeTitle = (title: string): string =>
  title.replaceAll(/\s+/g, ' ').replaceAll('-->', '→').trim();

/**
 * Builds a WebVTT chapters track from the VI-derived chapter list, attached to the
 * player as `<track kind="chapters">` so the seek bar can label segments (plan §4).
 */
export function buildChaptersVtt(chapters: readonly Chapter[]): string {
  const cues = chapters.map((chapter, index) => {
    const title = sanitizeTitle(chapter.title) || `Chapter ${String(index + 1)}`;
    return `${formatVttTimestamp(chapter.startSeconds)} --> ${formatVttTimestamp(chapter.endSeconds)}\n${title}`;
  });
  return ['WEBVTT', ...cues].join('\n\n');
}
