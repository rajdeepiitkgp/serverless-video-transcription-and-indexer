import { type Container } from '@azure/cosmos';
import { type VideoDocument, videoDocumentSchema } from '@vidx/shared';

import { type VideoRepository } from '../ports/video-repository.js';

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 404;
}

/**
 * Ordering uses `_ts` (Cosmos's last-write timestamp): the list view is
 * "most recently touched first", which also floats freshly processed videos up.
 */
const LIST_QUERY = 'SELECT * FROM c ORDER BY c._ts DESC';

/**
 * Contains-prefilter for search (plan §4: Cosmos query over transcript lines +
 * name/keywords/topics, case-insensitive). Core's `searchVideos` does the
 * authoritative matching on the returned documents.
 */
const SEARCH_QUERY = `
SELECT * FROM c WHERE
  CONTAINS(c.name, @term, true) OR
  EXISTS(SELECT VALUE k FROM k IN c.keywords WHERE CONTAINS(k, @term, true)) OR
  EXISTS(SELECT VALUE t FROM t IN c.topics WHERE CONTAINS(t, @term, true)) OR
  EXISTS(SELECT VALUE l FROM l IN c.transcript WHERE CONTAINS(l.text, @term, true))
ORDER BY c._ts DESC`;

/**
 * Cosmos `VideoMetadata` adapter (plan §5: partition key `/id`). Documents are
 * validated through the shared schema on every read and write — Cosmos system
 * fields are stripped by the schema, and an out-of-contract document surfaces as
 * a loud error, not silent corruption. Cross-partition queries are fine at this
 * scale (plan §5).
 */
export function createCosmosVideoRepository(container: Container): VideoRepository {
  async function query(spec: {
    query: string;
    parameters?: { name: string; value: string }[];
  }): Promise<VideoDocument[]> {
    const { resources } = await container.items.query(spec).fetchAll();
    return resources.map((resource: unknown) => videoDocumentSchema.parse(resource));
  }

  return {
    async get(uploadId: string): Promise<VideoDocument | null> {
      try {
        const { resource } = await container.item(uploadId, uploadId).read<VideoDocument>();
        return resource === undefined ? null : videoDocumentSchema.parse(resource);
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    list(): Promise<VideoDocument[]> {
      return query({ query: LIST_QUERY });
    },

    async create(document: VideoDocument): Promise<void> {
      await container.items.upsert(videoDocumentSchema.parse(document));
    },

    async delete(uploadId: string): Promise<void> {
      try {
        await container.item(uploadId, uploadId).delete();
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },

    search(term: string): Promise<VideoDocument[]> {
      return query({ query: SEARCH_QUERY, parameters: [{ name: '@term', value: term }] });
    },
  };
}
