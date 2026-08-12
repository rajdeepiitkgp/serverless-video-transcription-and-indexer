import { blobCreatedEventSchema } from '@vidx/shared';

import { parseVideoBlobUrl } from '../core/blob-path.js';
import { markFailed, markIndexing } from '../core/document-transitions.js';
import { composeFailedNotification } from '../core/notification.js';
import { DIAGNOSTIC_ENTRIES } from '../core/results-layout.js';
import { viSourceReadSasPolicy } from '../core/sas-policy.js';
import { type PipelineDependencies } from './dependencies.js';
import {
  captureDiagnostic,
  errorMessage,
  isDeterministicFailure,
  notifySafely,
  redactUrlSecrets,
  toJson,
} from './support.js';

/**
 * BlobCreated → submit to Video Indexer (plan §2 flow note 2).
 *
 * A malformed event throws (Event Grid retries, then dead-letters into an alert).
 * Blobs that didn't arrive through the API (no metadata document) are logged and
 * ignored. Deterministic VI rejections fail the video with a ❌ notification;
 * transient faults rethrow so Event Grid redelivers — the status guard makes the
 * redelivery idempotent.
 */
export async function processVideoUpload(
  rawEvent: unknown,
  deps: PipelineDependencies,
): Promise<void> {
  const event = blobCreatedEventSchema.parse(rawEvent);

  const path = parseVideoBlobUrl(event.data.url, deps.options.videosContainer);
  if (path === null) {
    deps.logger.warn('Ignoring blob outside {videos}/{uploadId}/{fileName}', {
      url: redactUrlSecrets(event.data.url),
    });
    return;
  }

  const { uploadId } = path;
  const document = await deps.metadata.get(uploadId);
  if (document === null) {
    deps.logger.warn('No metadata document for blob — not uploaded via the API; ignoring', {
      uploadId,
    });
    return;
  }

  const trackingId = document.trackingIds.upload;
  if (document.status !== 'Uploaded') {
    deps.logger.info('Duplicate BlobCreated delivery ignored', {
      uploadId,
      trackingId,
      status: document.status,
    });
    return;
  }

  await captureDiagnostic(deps, uploadId, DIAGNOSTIC_ENTRIES.processUpload.event, toJson(event));

  try {
    const videoUrl = await deps.uploads.createReadSasUrl(
      path.blobName,
      viSourceReadSasPolicy(deps.clock.now()),
    );
    const callbackUrl = new URL(deps.options.viCallbackUrl);
    callbackUrl.searchParams.set('uploadId', uploadId);

    const request = {
      name: document.name,
      videoUrl,
      callbackUrl: callbackUrl.toString(),
      externalId: uploadId,
    };
    const submitted = await deps.videoIndexer.submitVideo(request);

    await captureDiagnostic(
      deps,
      uploadId,
      DIAGNOSTIC_ENTRIES.processUpload.submission,
      toJson({
        request: {
          ...request,
          videoUrl: redactUrlSecrets(request.videoUrl),
          callbackUrl: redactUrlSecrets(request.callbackUrl),
        },
        response: submitted,
      }),
    );

    await deps.metadata.upsert(markIndexing(document, submitted.videoId, deps.clock.now()));
    deps.logger.info('Video submitted to Video Indexer', {
      uploadId,
      videoId: submitted.videoId,
      trackingId,
    });
  } catch (error) {
    const message = errorMessage(error);
    await captureDiagnostic(
      deps,
      uploadId,
      DIAGNOSTIC_ENTRIES.processUpload.error,
      toJson({ message }),
    );

    if (!isDeterministicFailure(error)) {
      deps.logger.error('Video Indexer submission errored; leaving for redelivery', {
        uploadId,
        trackingId,
        error: message,
      });
      throw error;
    }

    const failed = markFailed(document, message, deps.clock.now());
    await deps.metadata.upsert(failed);
    await notifySafely(
      deps,
      composeFailedNotification(failed, 'submission', trackingId, deps.options),
      uploadId,
    );
    deps.logger.error('Video Indexer rejected the submission; video failed', {
      uploadId,
      trackingId,
      error: message,
    });
  }
}
