import { type Chapter, type TranscriptLine } from '../contracts/video.js';
import { parseTimecode } from './timecode.js';
import { type ViIndex, type ViInstance } from './vi-index.js';

interface TimeRange {
  startSeconds: number;
  endSeconds: number;
}

/** Uses the edit-adjusted times when present; raw capture times otherwise. */
function instanceRange(instance: ViInstance): TimeRange {
  return {
    startSeconds: parseTimecode(instance.adjustedStart ?? instance.start),
    endSeconds: parseTimecode(instance.adjustedEnd ?? instance.end),
  };
}

function overlapSeconds(a: TimeRange, b: TimeRange): number {
  return Math.max(
    0,
    Math.min(a.endSeconds, b.endSeconds) - Math.max(a.startSeconds, b.startSeconds),
  );
}

/** Highest-confidence-first names, deduped case-insensitively, blanks dropped. */
function rankNames(entries: { name: string; confidence: number }[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const entry of [...entries].sort((a, b) => b.confidence - a.confidence)) {
    const name = entry.name.trim();
    const key = name.toLowerCase();
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Timestamped transcript lines, ordered by start time. Silence entries are dropped. */
export function parseTranscript(index: ViIndex): TranscriptLine[] {
  return index.videos
    .flatMap((video) => video.insights?.transcript ?? [])
    .flatMap((item) => {
      const text = item.text.trim();
      if (text === '') return [];
      return item.instances.map((instance) => ({ text, ...instanceRange(instance) }));
    })
    .sort((a, b) => a.startSeconds - b.startSeconds);
}

export function parseKeywords(index: ViIndex): string[] {
  return rankNames(
    index.videos
      .flatMap((video) => video.insights?.keywords ?? [])
      .map((keyword) => ({ name: keyword.text, confidence: keyword.confidence ?? 0 })),
  );
}

export function parseTopics(index: ViIndex): string[] {
  return rankNames(
    index.videos
      .flatMap((video) => video.insights?.topics ?? [])
      .map((topic) => ({ name: topic.name, confidence: topic.confidence ?? 0 })),
  );
}

/**
 * Chapter markers for the player (plan §4: derived from VI topics/scenes).
 *
 * Scenes give the segmentation; each scene is titled by the topic with the largest
 * time-overlap, falling back to "Chapter n". Without scenes, each topic's first
 * appearance becomes a chapter. Without either, there are no chapters.
 */
export function parseChapters(index: ViIndex): Chapter[] {
  const topics = index.videos
    .flatMap((video) => video.insights?.topics ?? [])
    .map((topic) => ({ name: topic.name, ranges: topic.instances.map(instanceRange) }));

  const scenes = index.videos
    .flatMap((video) => video.insights?.scenes ?? [])
    .flatMap((scene) => scene.instances.slice(0, 1))
    .map(instanceRange)
    .sort((a, b) => a.startSeconds - b.startSeconds);

  if (scenes.length > 0) {
    return scenes.map((scene, i) => ({
      title: dominantTopic(scene, topics) ?? `Chapter ${String(i + 1)}`,
      ...scene,
    }));
  }

  return topics
    .flatMap((topic) => topic.ranges.slice(0, 1).map((range) => ({ title: topic.name, ...range })))
    .sort((a, b) => a.startSeconds - b.startSeconds);
}

function dominantTopic(
  scene: TimeRange,
  topics: { name: string; ranges: TimeRange[] }[],
): string | null {
  let bestName: string | null = null;
  let bestOverlap = 0;
  for (const topic of topics) {
    const overlap = topic.ranges.reduce((total, range) => total + overlapSeconds(scene, range), 0);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestName = topic.name;
    }
  }
  return bestName;
}

/** VI thumbnail id used to fetch the poster/Discord image; null when none exists. */
export function parseThumbnailId(index: ViIndex): string | null {
  for (const video of index.videos) {
    if (video.thumbnailId) return video.thumbnailId;
  }
  return index.summarizedInsights?.thumbnailId ?? null;
}

/** Duration in seconds: root value, else summarized insights, else per-video timecode, else 0. */
export function parseDuration(index: ViIndex): number {
  if (typeof index.durationInSeconds === 'number') return index.durationInSeconds;
  const summarizedSeconds = index.summarizedInsights?.duration?.seconds;
  if (typeof summarizedSeconds === 'number') return summarizedSeconds;
  for (const video of index.videos) {
    const timecode = video.insights?.duration;
    if (timecode !== undefined) return parseTimecode(timecode);
  }
  return 0;
}

export interface ViFailure {
  code: string;
  message: string;
}

/** First reported indexing failure, or null when every video indexed cleanly. */
export function parseFailure(index: ViIndex): ViFailure | null {
  for (const video of index.videos) {
    const code = video.failureCode ?? 'None';
    const message = video.failureMessage ?? '';
    if (code !== 'None' || message !== '') {
      return { code, message };
    }
  }
  return null;
}

export interface VideoInsights {
  durationInSeconds: number;
  transcript: TranscriptLine[];
  keywords: string[];
  topics: string[];
  chapters: Chapter[];
  thumbnailId: string | null;
  failure: ViFailure | null;
}

/** Everything the pipeline persists to the Cosmos document, in one pass. */
export function extractInsights(index: ViIndex): VideoInsights {
  return {
    durationInSeconds: parseDuration(index),
    transcript: parseTranscript(index),
    keywords: parseKeywords(index),
    topics: parseTopics(index),
    chapters: parseChapters(index),
    thumbnailId: parseThumbnailId(index),
    failure: parseFailure(index),
  };
}
