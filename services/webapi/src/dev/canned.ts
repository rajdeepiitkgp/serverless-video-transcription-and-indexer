import {
  type Chapter,
  createTrackingId,
  type TranscriptLine,
  VIDEO_DOCUMENT_SCHEMA_VERSION,
  type VideoDocument,
  videoDocumentSchema,
} from '@vidx/shared';

/**
 * Canned insights for the local dev loop (plan §11): the same shape the pipeline's
 * fake Video Indexer produces, so uploads made under `pnpm dev` come back with a
 * believable transcript, keywords, topics, and chapters.
 */

export interface CannedInsights {
  durationInSeconds: number;
  keywords: string[];
  topics: string[];
  transcript: TranscriptLine[];
  chapters: Chapter[];
}

export const CANNED_INSIGHTS: CannedInsights = {
  durationInSeconds: 252,
  keywords: ['launch', 'roadmap', 'october', 'teaser campaign'],
  topics: ['Product planning', 'Marketing'],
  transcript: [
    { text: 'Welcome, everyone — thanks for making time.', startSeconds: 0, endSeconds: 6 },
    {
      text: 'First, the quarterly numbers before we move to the roadmap.',
      startSeconds: 6,
      endSeconds: 14,
    },
    { text: 'Now, the part everyone came for: the launch date.', startSeconds: 14, endSeconds: 21 },
    { text: "We're locking it to the second week of October.", startSeconds: 21, endSeconds: 27 },
    {
      text: 'Marketing kicks off the teaser campaign next Monday.',
      startSeconds: 27,
      endSeconds: 34,
    },
    { text: 'Questions before we wrap the session?', startSeconds: 34, endSeconds: 40 },
  ],
  chapters: [
    { title: 'Introductions', startSeconds: 0, endSeconds: 14 },
    { title: 'The launch date', startSeconds: 14, endSeconds: 27 },
    { title: 'Marketing plan', startSeconds: 27, endSeconds: 40 },
  ],
};

const INCIDENT_INSIGHTS: CannedInsights = {
  durationInSeconds: 1418,
  keywords: ['timeout', 'rollback', 'postmortem', 'alerting'],
  topics: ['Incident review', 'Reliability'],
  transcript: [
    { text: 'This is the review of the Tuesday outage.', startSeconds: 0, endSeconds: 5 },
    { text: 'The first alert fired at 14:02, but paging lagged.', startSeconds: 5, endSeconds: 12 },
    {
      text: 'Root cause was a connection-pool timeout under load.',
      startSeconds: 12,
      endSeconds: 19,
    },
    { text: 'The rollback restored service in eleven minutes.', startSeconds: 19, endSeconds: 25 },
    {
      text: 'Action items: tighten alerting and add a load test.',
      startSeconds: 25,
      endSeconds: 32,
    },
  ],
  chapters: [
    { title: 'Timeline', startSeconds: 0, endSeconds: 12 },
    { title: 'Root cause', startSeconds: 12, endSeconds: 19 },
    { title: 'Follow-ups', startSeconds: 19, endSeconds: 32 },
  ],
};

const pad = (value: number): string => String(value).padStart(2, '0');

const vttTimestamp = (totalSeconds: number): string => {
  const totalMillis = Math.round(Math.max(0, totalSeconds) * 1000);
  const seconds = Math.floor(totalMillis / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}.${String(totalMillis % 1000).padStart(3, '0')}`;
};

/** Minimal WebVTT for the captions artifact the pipeline would have written. */
export function toVtt(lines: readonly TranscriptLine[]): string {
  const cues = lines.map(
    (line) =>
      `${vttTimestamp(line.startSeconds)} --> ${vttTimestamp(line.endSeconds)}\n${line.text}`,
  );
  return ['WEBVTT', ...cues].join('\n\n');
}

interface SeedSpec {
  id: string;
  name: string;
  playable: boolean;
  status: VideoDocument['status'];
  uploadedBy: { userId: string; userDetails: string };
  insights?: CannedInsights;
  submittedMinutesAgo?: number;
  indexingSeconds?: number;
  error?: string;
}

const MINUTE_MS = 60_000;

function seedDocument(spec: SeedSpec, now: Date): VideoDocument {
  const submittedAt =
    spec.submittedMinutesAgo === undefined
      ? undefined
      : new Date(now.getTime() - spec.submittedMinutesAgo * MINUTE_MS).toISOString();
  const processedAt =
    spec.status === 'Processed' && spec.submittedMinutesAgo !== undefined
      ? new Date(
          now.getTime() -
            spec.submittedMinutesAgo * MINUTE_MS +
            (spec.indexingSeconds ?? 90) * 1000,
        ).toISOString()
      : undefined;
  const insights = spec.status === 'Processed' ? spec.insights : undefined;
  return videoDocumentSchema.parse({
    id: spec.id,
    videoId: spec.status === 'Uploaded' ? null : `vi-${spec.id}`,
    schemaVersion: VIDEO_DOCUMENT_SCHEMA_VERSION,
    name: spec.name,
    blobPath: `videos/${spec.id}/${spec.name}`,
    playable: spec.playable,
    status: spec.status,
    uploadedBy: spec.uploadedBy,
    ...(insights === undefined
      ? {}
      : {
          durationInSeconds: insights.durationInSeconds,
          keywords: insights.keywords,
          topics: insights.topics,
          transcript: insights.transcript,
          chapters: insights.chapters,
        }),
    resultsPrefix: `results/${spec.id}/`,
    trackingIds: { upload: createTrackingId() },
    ...(submittedAt === undefined ? {} : { submittedAt }),
    ...(processedAt === undefined ? {} : { processedAt }),
    error: spec.error ?? null,
  });
}

const ANA = { userId: 'dev-ana', userDetails: 'ana@example.com' };
const KIM = { userId: 'dev-kim', userDetails: 'kim@example.com' };

/**
 * The seeded library: processed footage to browse/search, a failure with a support
 * story, an inert `Uploaded` row, and one `Indexing` row the simulator completes
 * shortly after boot so the completion toast fires without uploading anything.
 * Seeded processed docs are deliberately non-playable containers — there are no
 * seeded bytes to stream — while anything uploaded through `pnpm dev` plays back
 * from the dev blob endpoint for real.
 */
export function seedDocuments(now: Date): VideoDocument[] {
  return [
    seedDocument(
      {
        id: 'seed-launch',
        name: 'launch-briefing.mkv',
        playable: false,
        status: 'Processed',
        uploadedBy: ANA,
        insights: CANNED_INSIGHTS,
        submittedMinutesAgo: 240,
        indexingSeconds: 84,
      },
      now,
    ),
    seedDocument(
      {
        id: 'seed-incident',
        name: 'incident-review.avi',
        playable: false,
        status: 'Processed',
        uploadedBy: KIM,
        insights: INCIDENT_INSIGHTS,
        submittedMinutesAgo: 1440,
        indexingSeconds: 132,
      },
      now,
    ),
    seedDocument(
      {
        id: 'seed-corrupt',
        name: 'hallway-cam.wmv',
        playable: false,
        status: 'Failed',
        uploadedBy: KIM,
        submittedMinutesAgo: 90,
        error: 'Video Indexer could not decode the stream (simulated failure).',
      },
      now,
    ),
    seedDocument(
      {
        id: 'seed-fresh',
        name: 'all-hands.mp4',
        playable: true,
        status: 'Uploaded',
        uploadedBy: ANA,
        submittedMinutesAgo: 2,
      },
      now,
    ),
    seedDocument(
      {
        // Non-playable so its simulated completion never points the player at a
        // blob with no seeded bytes behind it.
        id: 'seed-indexing',
        name: 'town-hall.mkv',
        playable: false,
        status: 'Indexing',
        uploadedBy: ANA,
        submittedMinutesAgo: 1,
      },
      now,
    ),
  ];
}
