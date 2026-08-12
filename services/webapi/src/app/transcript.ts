import { toTranscriptResponse } from '../core/projections.js';
import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';
import { apiError, ok, runAuthenticated } from './support.js';

/** GET /api/videos/{id}/transcript — timestamped transcript JSON (plan §4). */
export function handleGetTranscript(
  request: ApiRequest,
  deps: WebApiDependencies,
): Promise<ApiResponse> {
  return runAuthenticated('getTranscript', request, deps, async () => {
    const id = request.params.id ?? '';
    const document = await deps.videos.get(id);
    if (document === null) {
      return apiError(404, 'not_found', 'No such video.', deps.ids.trackingId());
    }
    if (document.status !== 'Processed') {
      return apiError(
        409,
        'not_ready',
        'The transcript is not ready yet — the video has not finished indexing.',
        deps.ids.trackingId(),
      );
    }
    return ok(toTranscriptResponse(document));
  });
}
