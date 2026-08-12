import {
  type TrackingId,
  type VideoDocument,
  videoDocumentSchema,
  type VideoInsights,
} from '@vidx/shared';

import { assertTransition } from './status.js';

/**
 * Pure document rewrites for each pipeline stage. Every result is re-validated
 * against the shared Cosmos schema, so an invalid document can never leave core —
 * the repository adapter just persists what it's given.
 */

/** Submission accepted by Video Indexer: attach VI's video id (plan §2 flow note 2). */
export function markIndexing(
  document: VideoDocument,
  videoId: string,
  submittedAt: Date,
): VideoDocument {
  assertTransition(document.status, 'Indexing');
  return videoDocumentSchema.parse({
    ...document,
    status: 'Indexing',
    videoId,
    submittedAt: submittedAt.toISOString(),
    error: null,
  });
}

/** Insights fetched and persisted: the terminal happy state (plan §2 flow note 5). */
export function markProcessed(
  document: VideoDocument,
  insights: VideoInsights,
  processedAt: Date,
  resultsTrackingId: TrackingId,
): VideoDocument {
  assertTransition(document.status, 'Processed');
  return videoDocumentSchema.parse({
    ...document,
    status: 'Processed',
    durationInSeconds: insights.durationInSeconds,
    keywords: insights.keywords,
    topics: insights.topics,
    transcript: insights.transcript,
    chapters: insights.chapters,
    thumbnailId: insights.thumbnailId,
    processedAt: processedAt.toISOString(),
    trackingIds: { ...document.trackingIds, results: resultsTrackingId },
    error: null,
  });
}

/** Terminal failure from any non-terminal state; `processedAt` records when it died. */
export function markFailed(
  document: VideoDocument,
  error: string,
  failedAt: Date,
  resultsTrackingId?: TrackingId,
): VideoDocument {
  assertTransition(document.status, 'Failed');
  return videoDocumentSchema.parse({
    ...document,
    status: 'Failed',
    error,
    processedAt: failedAt.toISOString(),
    trackingIds:
      resultsTrackingId === undefined
        ? document.trackingIds
        : { ...document.trackingIds, results: resultsTrackingId },
  });
}
