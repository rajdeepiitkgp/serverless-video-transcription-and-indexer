import { type DownloadResponse, transcriptDownloadQuerySchema } from '@vidx/shared';

import { attachmentDisposition, transcriptDownloadFileName } from '../core/content-disposition.js';
import { captionsBlobName } from '../core/results-layout.js';
import { downloadReadSasPolicy } from '../core/sas-policy.js';
import { sourceBlobName } from '../core/upload-policy.js';
import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';
import { apiError, ok, runAuthenticated } from './support.js';

/**
 * GET /api/videos/{id}/download — read SAS with `content-disposition: attachment`
 * for the source video (plan §4; open to every signed-in user per the round-3
 * decision). Available once the blob is guaranteed present — any status past
 * `Uploaded` (a failed indexing run still has a downloadable source).
 */
export function handleDownloadVideo(
  request: ApiRequest,
  deps: WebApiDependencies,
): Promise<ApiResponse> {
  return runAuthenticated('downloadVideo', request, deps, async (principal) => {
    const id = request.params.id ?? '';
    const document = await deps.videos.get(id);
    if (document === null) {
      return apiError(404, 'not_found', 'No such video.', deps.ids.trackingId());
    }
    if (document.status === 'Uploaded') {
      return apiError(
        409,
        'not_ready',
        'The video is still uploading — try again once it starts indexing.',
        deps.ids.trackingId(),
      );
    }

    const policy = downloadReadSasPolicy(deps.clock.now());
    const url = await deps.videoBlobs.createReadSasUrl(sourceBlobName(document.blobPath), policy, {
      contentDisposition: attachmentDisposition(document.name),
    });

    deps.logger.info('Source download issued', {
      uploadId: document.id,
      userId: principal.userId,
      userDetails: principal.userDetails,
    });

    const response: DownloadResponse = {
      url,
      fileName: document.name,
      expiresAt: policy.expiresOn.toISOString(),
    };
    return ok(response);
  });
}

/**
 * GET /api/videos/{id}/download/transcript?format=vtt|json — serves the transcript
 * file itself (not a SAS): the pipeline-written `transcript.vtt`, or the document's
 * timestamped lines as JSON.
 */
export function handleDownloadTranscript(
  request: ApiRequest,
  deps: WebApiDependencies,
): Promise<ApiResponse> {
  return runAuthenticated('downloadTranscript', request, deps, async (principal) => {
    const parsedQuery = transcriptDownloadQuerySchema.safeParse({
      ...(request.query.format === undefined ? {} : { format: request.query.format }),
    });
    if (!parsedQuery.success) {
      return apiError(
        400,
        'validation_failed',
        'format must be "vtt" or "json".',
        deps.ids.trackingId(),
      );
    }
    const format = parsedQuery.data.format;

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

    deps.logger.info('Transcript download issued', {
      uploadId: document.id,
      format,
      userId: principal.userId,
      userDetails: principal.userDetails,
    });

    const disposition = attachmentDisposition(transcriptDownloadFileName(document.name, format));
    if (format === 'json') {
      return {
        status: 200,
        body: JSON.stringify(document.transcript),
        headers: {
          'content-type': 'application/json',
          'content-disposition': disposition,
        },
      };
    }

    const captions = await deps.results.read(captionsBlobName(document.id));
    if (captions === null) {
      // Processed without a captions artifact is a pipeline contract violation.
      throw new Error(`Captions artifact missing for processed video ${document.id}`);
    }
    return {
      status: 200,
      body: captions,
      headers: {
        'content-type': 'text/vtt',
        'content-disposition': disposition,
      },
    };
  });
}
