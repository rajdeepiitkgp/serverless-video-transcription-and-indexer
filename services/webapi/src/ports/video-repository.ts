import { type VideoDocument } from '@vidx/shared';

/** The Cosmos `VideoMetadata` container, as the webapi consumes it (plan §5). */
export interface VideoRepository {
  get(uploadId: string): Promise<VideoDocument | null>;
  /** Every document, most recently written first. Fine at this scale (plan §4). */
  list(): Promise<VideoDocument[]>;
  create(document: VideoDocument): Promise<void>;
  /** Deleting a missing document is a no-op (delete must be idempotent). */
  delete(uploadId: string): Promise<void>;
  /**
   * Case-insensitive contains prefilter across name/keywords/topics/transcript
   * text (plan §4). Core's `searchVideos` is the authoritative matcher on top.
   */
  search(term: string): Promise<VideoDocument[]>;
}
