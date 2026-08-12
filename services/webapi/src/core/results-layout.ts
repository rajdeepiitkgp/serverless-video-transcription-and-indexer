/**
 * Blob layout inside the results container, as written by the pipeline (its
 * `core/results-layout.ts` is the source of truth): the webapi only reads the
 * player-facing captions artifact and deletes a video's whole prefix.
 */
export function captionsBlobName(uploadId: string): string {
  return `${uploadId}/transcript.vtt`;
}

/** Everything the pipeline wrote for one video, diagnostics included. */
export function resultsPrefix(uploadId: string): string {
  return `${uploadId}/`;
}
