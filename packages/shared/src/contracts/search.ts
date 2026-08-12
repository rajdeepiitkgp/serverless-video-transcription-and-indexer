import * as z from 'zod';

import { videoStatusSchema } from './video.js';

/** GET /api/search?q= query. */
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

/**
 * A single hit inside a video. Transcript matches carry the timestamp that powers
 * search-to-seek (`/videos/watch?id=…&t=…`, plan §4).
 */
export const searchMatchSchema = z
  .object({
    field: z.enum(['name', 'keyword', 'topic', 'transcript']),
    snippet: z.string().min(1),
    startSeconds: z.number().nonnegative().optional(),
  })
  .meta({ id: 'SearchMatch' });

export type SearchMatch = z.infer<typeof searchMatchSchema>;

export const searchResultSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    status: videoStatusSchema,
    matches: z.array(searchMatchSchema).min(1),
  })
  .meta({ id: 'SearchResult' });

export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z
  .object({ results: z.array(searchResultSchema) })
  .meta({ id: 'SearchResponse' });

export type SearchResponse = z.infer<typeof searchResponseSchema>;
