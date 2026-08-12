export interface SubmitVideoRequest {
  name: string;
  /** Short-lived read SAS for the private source blob (plan §2 deviation 3). */
  videoUrl: string;
  /** IndexingCallback function URL with `uploadId` appended (plan §2 deviation 2). */
  callbackUrl: string;
  /** Our uploadId, stored on the VI video for reverse lookup. */
  externalId: string;
}

export interface SubmittedVideo {
  videoId: string;
  state: string;
}

/**
 * Thrown by adapters when Video Indexer answers with a non-2xx status. The status
 * lets use-cases separate deterministic rejections (4xx → fail the video) from
 * transient faults (5xx/429 → rethrow so Event Grid redelivers).
 */
export class VideoIndexerRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'VideoIndexerRequestError';
  }
}

export interface VideoIndexerClient {
  submitVideo(request: SubmitVideoRequest): Promise<SubmittedVideo>;
  /** Raw "Get Video Index" JSON — callers validate with `parseViIndex` at the boundary. */
  getIndex(videoId: string): Promise<unknown>;
  /** WebVTT captions text. */
  getCaptions(videoId: string): Promise<string>;
  /** JPEG bytes for the given thumbnail id. */
  getThumbnail(videoId: string, thumbnailId: string): Promise<Uint8Array>;
}
