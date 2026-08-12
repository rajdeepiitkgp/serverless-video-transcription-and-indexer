import {
  type TranscriptResponse,
  transcriptResponseSchema,
  type VideoDetail,
  videoDetailSchema,
  type VideoDocument,
  type VideoSummary,
  videoSummarySchema,
} from '@vidx/shared';

/**
 * Projections from the Cosmos document to the API response shapes. Everything is
 * parsed through the shared schemas, so a response that drifts from the contract
 * fails loudly here instead of shipping to the UI.
 */
export function toVideoSummary(document: VideoDocument): VideoSummary {
  return videoSummarySchema.parse({
    id: document.id,
    name: document.name,
    status: document.status,
    playable: document.playable,
    uploadedBy: document.uploadedBy,
    durationInSeconds: document.durationInSeconds,
    thumbnailId: document.thumbnailId,
    submittedAt: document.submittedAt,
    processedAt: document.processedAt,
  });
}

export interface VideoDetailUrls {
  /** Short-lived playback SAS; null unless the video is Processed and playable. */
  playbackUrl: string | null;
  /** SAS for `transcript.vtt` in the results container; null until Processed. */
  captionsUrl: string | null;
}

export function toVideoDetail(document: VideoDocument, urls: VideoDetailUrls): VideoDetail {
  return videoDetailSchema.parse({
    ...toVideoSummary(document),
    keywords: document.keywords,
    topics: document.topics,
    chapters: document.chapters,
    playbackUrl: urls.playbackUrl,
    captionsUrl: urls.captionsUrl,
    error: document.error,
  });
}

export function toTranscriptResponse(document: VideoDocument): TranscriptResponse {
  return transcriptResponseSchema.parse({
    id: document.id,
    name: document.name,
    lines: document.transcript,
  });
}
