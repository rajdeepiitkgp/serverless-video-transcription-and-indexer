import { uploadRequestSchema, type UploadResponse } from '@vidx/shared';

import { uploadWriteSasPolicy } from '../core/sas-policy.js';
import { createUploadedDocument, uploadBlobName, validateUpload } from '../core/upload-policy.js';
import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';
import { apiError, created, runAuthenticated } from './support.js';

/**
 * POST /api/uploads (plan §2 flow note 1): validate type/size, create the `Uploaded`
 * document stamped with the caller, and return a short-lived write-only SAS for the
 * browser's direct PUT. The document is written before the SAS is issued — a failed
 * SAS leaves an inert `Uploaded` row, never an unreachable blob.
 */
export function handleCreateUpload(
  request: ApiRequest,
  deps: WebApiDependencies,
): Promise<ApiResponse> {
  return runAuthenticated('createUpload', request, deps, async (principal) => {
    const parsed = uploadRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const trackingId = deps.ids.trackingId();
      deps.logger.warn('Upload request failed validation', {
        trackingId,
        issues: parsed.error.issues.map((issue) => issue.message).join('; '),
      });
      return apiError(400, 'validation_failed', 'Invalid upload request.', trackingId);
    }

    const verdict = validateUpload(parsed.data);
    if (!verdict.ok) {
      const trackingId = deps.ids.trackingId();
      deps.logger.warn('Upload request rejected by policy', {
        trackingId,
        reason: verdict.reason,
        fileName: parsed.data.fileName,
      });
      return apiError(400, 'validation_failed', verdict.message, trackingId);
    }

    const uploadId = deps.ids.uploadId();
    const trackingId = deps.ids.trackingId();
    const document = createUploadedDocument({
      uploadId,
      upload: parsed.data,
      playable: verdict.playable,
      uploadedBy: { userId: principal.userId, userDetails: principal.userDetails },
      trackingId,
      videosContainer: deps.options.videosContainer,
      resultsContainer: deps.options.resultsContainer,
    });
    await deps.videos.create(document);

    const policy = uploadWriteSasPolicy(deps.clock.now());
    const uploadUrl = await deps.videoBlobs.createUploadSasUrl(
      uploadBlobName(uploadId, parsed.data.fileName),
      policy,
    );

    deps.logger.info('Upload slot created', {
      uploadId,
      trackingId,
      userId: principal.userId,
      fileName: parsed.data.fileName,
      sizeBytes: parsed.data.sizeBytes,
      playable: verdict.playable,
    });

    const response: UploadResponse = {
      uploadId,
      uploadUrl,
      blobPath: document.blobPath,
      playable: verdict.playable,
      expiresAt: policy.expiresOn.toISOString(),
    };
    return created(response);
  });
}
