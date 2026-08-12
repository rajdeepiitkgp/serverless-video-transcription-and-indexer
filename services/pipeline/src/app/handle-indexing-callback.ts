import {
  VIDEO_INDEXING_COMPLETED_EVENT_TYPE,
  videoIndexingCompletedEventSchema,
} from '@vidx/shared';

import { parseCallbackQuery } from '../core/callback.js';
import { DIAGNOSTIC_ENTRIES } from '../core/results-layout.js';
import { type PipelineDependencies } from './dependencies.js';
import { captureDiagnostic, toJson } from './support.js';

export interface CallbackResult {
  status: number;
  body: string;
}

/**
 * Video Indexer's callback (plan §2 flow note 4). The payload is untrusted: nothing
 * is read back from it except which video to look at — this handler only republishes
 * a `VideoIndexing.Completed` event to the custom topic. `ProcessVideoResults`
 * fetches the authoritative state from VI itself, so forged callbacks yield nothing.
 */
export async function handleIndexingCallback(
  query: Readonly<Record<string, string | undefined>>,
  deps: PipelineDependencies,
): Promise<CallbackResult> {
  const data = parseCallbackQuery(query);
  if (data === null) {
    deps.logger.warn('Ignoring non-terminal or malformed VI callback', {
      videoId: query.id ?? null,
      state: query.state ?? null,
    });
    return { status: 200, body: 'ignored' };
  }

  const event = videoIndexingCompletedEventSchema.parse({
    id: deps.ids.eventId(),
    subject: `videos/${data.uploadId ?? data.videoId}`,
    eventType: VIDEO_INDEXING_COMPLETED_EVENT_TYPE,
    eventTime: deps.clock.now().toISOString(),
    dataVersion: '1',
    data,
  });

  if (data.uploadId !== undefined) {
    await captureDiagnostic(
      deps,
      data.uploadId,
      DIAGNOSTIC_ENTRIES.indexingCallback.query,
      toJson({ id: data.videoId, state: data.state, uploadId: data.uploadId }),
    );
  }

  // A publish failure escapes on purpose: the function returns 500 and the failure
  // count feeds the Azure-side alerts (plan §8).
  await deps.events.publishIndexingCompleted(event);

  if (data.uploadId !== undefined) {
    await captureDiagnostic(
      deps,
      data.uploadId,
      DIAGNOSTIC_ENTRIES.indexingCallback.publishedEvent,
      toJson(event),
    );
  }

  deps.logger.info('Republished VI callback to the custom topic', {
    videoId: data.videoId,
    uploadId: data.uploadId ?? null,
    state: data.state,
    eventId: event.id,
  });
  return { status: 200, body: 'accepted' };
}
