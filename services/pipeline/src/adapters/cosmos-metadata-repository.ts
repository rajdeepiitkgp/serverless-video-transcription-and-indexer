import { type Container } from '@azure/cosmos';
import { type VideoDocument, videoDocumentSchema } from '@vidx/shared';

import { type MetadataRepository } from '../ports/metadata-repository.js';

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 404;
}

/**
 * Cosmos `VideoMetadata` adapter (plan §5: partition key `/id`). Documents are
 * validated through the shared schema on every read and write — Cosmos system
 * fields (`_rid`, `_etag`, …) are stripped by the schema, and an out-of-contract
 * document surfaces as a loud error, not silent corruption.
 */
export function createCosmosMetadataRepository(container: Container): MetadataRepository {
  return {
    async get(uploadId: string): Promise<VideoDocument | null> {
      try {
        // The type parameter only quiets the SDK's `any`-flavored ItemDefinition —
        // the schema parse below is what actually establishes the contract.
        const { resource } = await container.item(uploadId, uploadId).read<VideoDocument>();
        return resource === undefined ? null : videoDocumentSchema.parse(resource);
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async findByVideoId(videoId: string): Promise<VideoDocument | null> {
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.videoId = @videoId',
          parameters: [{ name: '@videoId', value: videoId }],
        })
        .fetchAll();
      const first: unknown = resources[0];
      return first === undefined ? null : videoDocumentSchema.parse(first);
    },

    async upsert(document: VideoDocument): Promise<void> {
      await container.items.upsert(videoDocumentSchema.parse(document));
    },
  };
}
