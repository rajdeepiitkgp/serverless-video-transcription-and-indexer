import { searchQuerySchema, type SearchResponse } from '@vidx/shared';

import { searchVideos } from '../core/search.js';
import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';
import { apiError, ok, runAuthenticated } from './support.js';

/**
 * GET /api/search?q= — case-insensitive contains across name/keywords/topics/
 * transcript lines (plan §4). The repository query prefilters; core builds the
 * matches with search-to-seek timestamps.
 */
export function handleSearch(request: ApiRequest, deps: WebApiDependencies): Promise<ApiResponse> {
  return runAuthenticated('search', request, deps, async (principal) => {
    const parsed = searchQuerySchema.safeParse({
      ...(request.query.q === undefined ? {} : { q: request.query.q }),
    });
    if (!parsed.success) {
      return apiError(
        400,
        'validation_failed',
        'q is required (1–200 characters).',
        deps.ids.trackingId(),
      );
    }

    // Search queries are part of the audit trail (plan §6).
    deps.logger.info('Search', {
      q: parsed.data.q,
      userId: principal.userId,
      userDetails: principal.userDetails,
    });

    const candidates = await deps.videos.search(parsed.data.q);
    const response: SearchResponse = { results: searchVideos(candidates, parsed.data.q) };
    return ok(response);
  });
}
