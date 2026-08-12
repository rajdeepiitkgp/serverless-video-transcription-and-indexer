import { toVideoDetail, toVideoSummary } from '../core/projections.js';
import { captionsBlobName } from '../core/results-layout.js';
import { playbackReadSasPolicy } from '../core/sas-policy.js';
import { sourceBlobName } from '../core/upload-policy.js';
import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';
import { apiError, ok, runAuthenticated } from './support.js';

/** GET /api/videos — the library list (plan §4). */
export function handleListVideos(
  request: ApiRequest,
  deps: WebApiDependencies,
): Promise<ApiResponse> {
  return runAuthenticated('listVideos', request, deps, async () => {
    const documents = await deps.videos.list();
    return ok({ videos: documents.map(toVideoSummary) });
  });
}

/**
 * GET /api/videos/{id} — full metadata + insight summary + short-lived playback SAS
 * + captions URL (plan §4). Playback stays null until Processed and only for
 * browser-playable formats; captions appear once the pipeline wrote transcript.vtt.
 */
export function handleGetVideo(
  request: ApiRequest,
  deps: WebApiDependencies,
): Promise<ApiResponse> {
  return runAuthenticated('getVideo', request, deps, async () => {
    const id = request.params.id ?? '';
    const document = await deps.videos.get(id);
    if (document === null) {
      return apiError(404, 'not_found', 'No such video.', deps.ids.trackingId());
    }

    const processed = document.status === 'Processed';
    const policy = playbackReadSasPolicy(deps.clock.now());
    const playbackUrl =
      processed && document.playable
        ? await deps.videoBlobs.createReadSasUrl(sourceBlobName(document.blobPath), policy)
        : null;
    const captionsUrl = processed
      ? await deps.results.createReadSasUrl(captionsBlobName(document.id), policy)
      : null;

    return ok(toVideoDetail(document, { playbackUrl, captionsUrl }));
  });
}
