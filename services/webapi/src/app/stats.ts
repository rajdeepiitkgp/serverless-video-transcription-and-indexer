import { computeStats } from '../core/stats.js';
import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';
import { ok, runAuthenticated } from './support.js';

/** GET /api/stats — dashboard aggregates (plan §4). */
export function handleGetStats(
  request: ApiRequest,
  deps: WebApiDependencies,
): Promise<ApiResponse> {
  return runAuthenticated('getStats', request, deps, async () => {
    const documents = await deps.videos.list();
    return ok(computeStats(documents, deps.clock.now()));
  });
}
