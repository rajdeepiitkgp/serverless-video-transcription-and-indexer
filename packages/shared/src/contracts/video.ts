import * as z from 'zod';

import { trackingIdSchema } from './envelope.js';

/** Pipeline status stamped on the Cosmos document (plan §5). */
export const videoStatusSchema = z
  .enum(['Uploaded', 'Indexing', 'Processed', 'Failed'])
  .meta({ id: 'VideoStatus' });

export type VideoStatus = z.infer<typeof videoStatusSchema>;

export const transcriptLineSchema = z
  .object({
    text: z.string(),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().nonnegative(),
  })
  .meta({ id: 'TranscriptLine' });

export type TranscriptLine = z.infer<typeof transcriptLineSchema>;

/** Player chapter marker, derived from VI topics/scenes (plan §4). */
export const chapterSchema = z
  .object({
    title: z.string(),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().nonnegative(),
  })
  .meta({ id: 'Chapter' });

export type Chapter = z.infer<typeof chapterSchema>;

/** Identity captured from the SWA client principal at upload time. */
export const uploadedBySchema = z
  .object({
    userId: z.string().min(1),
    userDetails: z.string().min(1),
  })
  .meta({ id: 'UploadedBy' });

export type UploadedBy = z.infer<typeof uploadedBySchema>;

export const VIDEO_DOCUMENT_SCHEMA_VERSION = 1;

/**
 * The Cosmos `VideoMetadata` document (plan §5). Keyed by uploadId; `videoId` is VI's
 * id, attached at submission. Insight fields default empty so documents written at
 * earlier pipeline stages read cleanly (tolerant reads, docs/style-guide.md).
 * `chapters` and `thumbnailId` are additive fields beyond the plan's illustration,
 * consumed by the watch page and the Discord notifier.
 */
export const videoDocumentSchema = z
  .object({
    id: z.string().min(1),
    videoId: z.string().min(1).nullable(),
    schemaVersion: z.literal(VIDEO_DOCUMENT_SCHEMA_VERSION),
    name: z.string().min(1),
    blobPath: z.string().min(1),
    playable: z.boolean(),
    status: videoStatusSchema,
    uploadedBy: uploadedBySchema,
    durationInSeconds: z.number().nonnegative().optional(),
    keywords: z.array(z.string()).default([]),
    topics: z.array(z.string()).default([]),
    transcript: z.array(transcriptLineSchema).default([]),
    chapters: z.array(chapterSchema).default([]),
    thumbnailId: z.string().nullish(),
    resultsPrefix: z.string().min(1),
    trackingIds: z.object({
      upload: trackingIdSchema,
      results: trackingIdSchema.optional(),
    }),
    submittedAt: z.iso.datetime().optional(),
    processedAt: z.iso.datetime().optional(),
    error: z.string().nullable().default(null),
  })
  .meta({ id: 'VideoDocument' });

export type VideoDocument = z.infer<typeof videoDocumentSchema>;
