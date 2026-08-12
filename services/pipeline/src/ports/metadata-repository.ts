import { type VideoDocument } from '@vidx/shared';

/** The Cosmos `VideoMetadata` container, as the pipeline consumes it (plan §5). */
export interface MetadataRepository {
  get(uploadId: string): Promise<VideoDocument | null>;
  /** Reverse lookup for callbacks that only carry VI's video id. */
  findByVideoId(videoId: string): Promise<VideoDocument | null>;
  upsert(document: VideoDocument): Promise<void>;
}
