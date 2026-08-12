/**
 * Blob layout inside the results container (plan §2 flow notes 5–6):
 *
 *   {uploadId}/insights.json        — parsed VideoInsights (app-facing artifact)
 *   {uploadId}/transcript.vtt       — captions fetched from VI, served to the player
 *   {uploadId}/diagnostics/…        — raw stage inputs/outputs for download & replay (§7)
 *
 * Diagnostics entry names are constants so the capture code, the tests, the replay
 * bundle loader, and `pnpm diagnostics` all agree on one format.
 */
export function insightsBlobName(uploadId: string): string {
  return `${uploadId}/insights.json`;
}

export function captionsBlobName(uploadId: string): string {
  return `${uploadId}/transcript.vtt`;
}

export function diagnosticsBlobName(uploadId: string, entryName: string): string {
  return `${uploadId}/diagnostics/${entryName}`;
}

export const DIAGNOSTIC_ENTRIES = {
  processUpload: {
    event: 'process-upload/01-blob-created-event.json',
    submission: 'process-upload/02-vi-submission.json',
    error: 'process-upload/99-error.json',
  },
  indexingCallback: {
    query: 'indexing-callback/01-callback-query.json',
    publishedEvent: 'indexing-callback/02-published-event.json',
  },
  processResults: {
    event: 'process-results/01-completed-event.json',
    viIndex: 'process-results/02-vi-index.json',
    viCaptions: 'process-results/03-vi-captions.vtt',
    outputs: 'process-results/04-composed-outputs.json',
    error: 'process-results/99-error.json',
  },
} as const;
