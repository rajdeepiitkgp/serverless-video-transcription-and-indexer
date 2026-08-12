import { type DeleteResponse } from '@vidx/shared';

import { canDeleteVideo } from '../core/authz.js';
import { resultsPrefix } from '../core/results-layout.js';
import { sourceBlobName } from '../core/upload-policy.js';
import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';
import { apiError, ok, runAuthenticated } from './support.js';

/**
 * DELETE /api/videos/{id} — the one role-differentiated endpoint (plan §4): owners
 * delete their own uploads, admins delete any. Removes the source blob, the whole
 * results prefix (insights, captions, diagnostics), and finally the metadata
 * document — so a failure partway leaves the document behind and the delete
 * retryable, never an orphaned document pointing at nothing.
 */
export function handleDeleteVideo(
  request: ApiRequest,
  deps: WebApiDependencies,
): Promise<ApiResponse> {
  return runAuthenticated('deleteVideo', request, deps, async (principal) => {
    const id = request.params.id ?? '';
    const document = await deps.videos.get(id);
    if (document === null) {
      return apiError(404, 'not_found', 'No such video.', deps.ids.trackingId());
    }

    if (!canDeleteVideo(principal, document)) {
      const trackingId = deps.ids.trackingId();
      deps.logger.warn('Delete denied', {
        trackingId,
        uploadId: id,
        userId: principal.userId,
        ownerId: document.uploadedBy.userId,
      });
      return apiError(
        403,
        'forbidden',
        'Only the uploader or an admin can delete a video.',
        trackingId,
      );
    }

    await deps.videoBlobs.delete(sourceBlobName(document.blobPath));
    await deps.results.deletePrefix(resultsPrefix(document.id));
    await deps.videos.delete(document.id);

    deps.logger.info('Video deleted', {
      uploadId: document.id,
      userId: principal.userId,
      userDetails: principal.userDetails,
      ownerId: document.uploadedBy.userId,
    });

    const response: DeleteResponse = { id: document.id };
    return ok(response);
  });
}
