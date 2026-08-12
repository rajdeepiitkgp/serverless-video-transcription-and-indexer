import { extractInsights, parseViIndex, videoIndexingCompletedEventSchema } from '@vidx/shared';

import { markFailed, markProcessed } from '../core/document-transitions.js';
import {
  composeFailedNotification,
  composeProcessedNotification,
  type NotificationAttachment,
} from '../core/notification.js';
import { captionsBlobName, DIAGNOSTIC_ENTRIES, insightsBlobName } from '../core/results-layout.js';
import { isTerminal } from '../core/status.js';
import { type PipelineDependencies } from './dependencies.js';
import {
  captureDiagnostic,
  errorMessage,
  isDeterministicFailure,
  notifySafely,
  toJson,
} from './support.js';

/**
 * VideoIndexing.Completed → fetch the authoritative index from VI, persist artifacts,
 * finalize the document, notify Discord (plan §2 flow notes 5–6).
 *
 * VI-reported failures (and payloads our schema rejects) are terminal: Failed doc +
 * ❌ embed, no rethrow — redelivery can't fix them. Transient faults rethrow so Event
 * Grid redelivers; the terminal-status guard makes redeliveries no-ops.
 */
export async function processVideoResults(
  rawEvent: unknown,
  deps: PipelineDependencies,
): Promise<void> {
  const event = videoIndexingCompletedEventSchema.parse(rawEvent);
  const { videoId, state, uploadId } = event.data;

  const document =
    uploadId !== undefined
      ? await deps.metadata.get(uploadId)
      : await deps.metadata.findByVideoId(videoId);
  if (document === null) {
    deps.logger.warn('No metadata document for completed video; ignoring', {
      videoId,
      uploadId: uploadId ?? null,
    });
    return;
  }
  if (isTerminal(document.status)) {
    deps.logger.info('Duplicate completion delivery ignored', {
      uploadId: document.id,
      videoId,
      status: document.status,
    });
    return;
  }

  const trackingId = deps.ids.trackingId();
  await captureDiagnostic(
    deps,
    document.id,
    DIAGNOSTIC_ENTRIES.processResults.event,
    toJson(event),
  );

  try {
    const rawIndex = await deps.videoIndexer.getIndex(videoId);
    await captureDiagnostic(
      deps,
      document.id,
      DIAGNOSTIC_ENTRIES.processResults.viIndex,
      toJson(rawIndex),
    );

    const insights = extractInsights(parseViIndex(rawIndex));

    if (state === 'Failed' || insights.failure !== null) {
      const message =
        insights.failure === null
          ? 'Video Indexer reported failure without details'
          : `${insights.failure.code}: ${insights.failure.message}`;
      const failed = markFailed(document, message, deps.clock.now(), trackingId);
      await deps.metadata.upsert(failed);
      await notifySafely(
        deps,
        composeFailedNotification(failed, 'results', trackingId, deps.options),
        document.id,
      );
      await captureDiagnostic(
        deps,
        document.id,
        DIAGNOSTIC_ENTRIES.processResults.outputs,
        toJson({ document: failed }),
      );
      deps.logger.error('Video Indexer reported indexing failure', {
        uploadId: document.id,
        videoId,
        trackingId,
        error: message,
      });
      return;
    }

    const captions = await deps.videoIndexer.getCaptions(videoId);
    await deps.results.write(captionsBlobName(document.id), captions, 'text/vtt');
    await captureDiagnostic(
      deps,
      document.id,
      DIAGNOSTIC_ENTRIES.processResults.viCaptions,
      captions,
      'text/vtt',
    );
    await deps.results.write(insightsBlobName(document.id), toJson(insights), 'application/json');

    let thumbnail: NotificationAttachment | null = null;
    if (insights.thumbnailId !== null) {
      try {
        thumbnail = {
          fileName: 'thumbnail.jpg',
          contentType: 'image/jpeg',
          data: await deps.videoIndexer.getThumbnail(videoId, insights.thumbnailId),
        };
      } catch (error) {
        deps.logger.warn('Thumbnail fetch failed; notifying without it', {
          uploadId: document.id,
          videoId,
          error: errorMessage(error),
        });
      }
    }

    const processed = markProcessed(document, insights, deps.clock.now(), trackingId);
    await deps.metadata.upsert(processed);

    const notification = composeProcessedNotification(processed, deps.options, thumbnail);
    await notifySafely(deps, notification, document.id);

    await captureDiagnostic(
      deps,
      document.id,
      DIAGNOSTIC_ENTRIES.processResults.outputs,
      toJson({
        document: processed,
        notification: {
          embeds: notification.embeds,
          attachment:
            thumbnail === null
              ? null
              : {
                  fileName: thumbnail.fileName,
                  contentType: thumbnail.contentType,
                  bytes: thumbnail.data.byteLength,
                },
        },
      }),
    );
    deps.logger.info('Video processed', {
      uploadId: document.id,
      videoId,
      trackingId,
      transcriptLines: insights.transcript.length,
    });
  } catch (error) {
    const message = errorMessage(error);
    await captureDiagnostic(
      deps,
      document.id,
      DIAGNOSTIC_ENTRIES.processResults.error,
      toJson({ message }),
    );

    if (!isDeterministicFailure(error)) {
      deps.logger.error('Results processing errored; leaving for redelivery', {
        uploadId: document.id,
        videoId,
        trackingId,
        error: message,
      });
      throw error;
    }

    const failed = markFailed(document, message, deps.clock.now(), trackingId);
    await deps.metadata.upsert(failed);
    await notifySafely(
      deps,
      composeFailedNotification(failed, 'results', trackingId, deps.options),
      document.id,
    );
    deps.logger.error('Results processing failed deterministically; video failed', {
      uploadId: document.id,
      videoId,
      trackingId,
      error: message,
    });
  }
}
