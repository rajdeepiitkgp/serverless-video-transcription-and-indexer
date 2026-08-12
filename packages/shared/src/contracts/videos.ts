import * as z from 'zod';

import {
  chapterSchema,
  transcriptLineSchema,
  uploadedBySchema,
  videoStatusSchema,
} from './video.js';

/** GET /api/videos list item (plan §4: status, name, duration, uploader, playable). */
export const videoSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    status: videoStatusSchema,
    playable: z.boolean(),
    uploadedBy: uploadedBySchema,
    durationInSeconds: z.number().nonnegative().optional(),
    thumbnailId: z.string().nullish(),
    submittedAt: z.iso.datetime().optional(),
    processedAt: z.iso.datetime().optional(),
  })
  .meta({ id: 'VideoSummary' });

export type VideoSummary = z.infer<typeof videoSummarySchema>;

/**
 * GET /api/videos/{id}: full metadata + insight summary + short-lived playback SAS +
 * captions URL. Playback/captions are null until the video is Processed (and playback
 * stays null for non-browser-playable formats).
 */
export const videoDetailSchema = videoSummarySchema
  .extend({
    keywords: z.array(z.string()).default([]),
    topics: z.array(z.string()).default([]),
    chapters: z.array(chapterSchema).default([]),
    playbackUrl: z.url().nullable().default(null),
    captionsUrl: z.url().nullable().default(null),
    error: z.string().nullable().default(null),
  })
  .meta({ id: 'VideoDetail' });

export type VideoDetail = z.infer<typeof videoDetailSchema>;

/** GET /api/videos/{id}/transcript — timestamped transcript JSON. */
export const transcriptResponseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    lines: z.array(transcriptLineSchema),
  })
  .meta({ id: 'TranscriptResponse' });

export type TranscriptResponse = z.infer<typeof transcriptResponseSchema>;

/** GET /api/videos/{id}/download — read SAS with content-disposition: attachment. */
export const downloadResponseSchema = z
  .object({
    url: z.url(),
    fileName: z.string().min(1),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'DownloadResponse' });

export type DownloadResponse = z.infer<typeof downloadResponseSchema>;

/** GET /api/videos/{id}/download/transcript?format=vtt|json query. */
export const transcriptDownloadQuerySchema = z.object({
  format: z.enum(['vtt', 'json']).default('vtt'),
});

export type TranscriptDownloadQuery = z.infer<typeof transcriptDownloadQuerySchema>;

/** DELETE /api/videos/{id} — owner or admin only (plan §4). */
export const deleteResponseSchema = z
  .object({ id: z.string().min(1) })
  .meta({ id: 'DeleteResponse' });

export type DeleteResponse = z.infer<typeof deleteResponseSchema>;
