import * as z from 'zod';

import { eventGridEventOf } from './event-grid.js';

/**
 * Published to the custom topic by `IndexingCallback` when Video Indexer reports a
 * terminal state. The callback is untrusted input (plan §2 flow note 4): this event
 * only names the video — `ProcessVideoResults` fetches the authoritative index from
 * VI itself, so forged callbacks yield nothing.
 */
export const VIDEO_INDEXING_COMPLETED_EVENT_TYPE = 'VideoIndexing.Completed';

export const videoIndexingStateSchema = z
  .enum(['Processed', 'Failed'])
  .meta({ id: 'VideoIndexingState' });

export type VideoIndexingState = z.infer<typeof videoIndexingStateSchema>;

export const videoIndexingCompletedDataSchema = z
  .object({
    videoId: z.string().min(1),
    state: videoIndexingStateSchema,
    /** Round-tripped through the callback URL when available; else resolved via Cosmos. */
    uploadId: z.string().min(1).optional(),
  })
  .meta({ id: 'VideoIndexingCompletedEventData' });

export type VideoIndexingCompletedEventData = z.infer<typeof videoIndexingCompletedDataSchema>;

export const videoIndexingCompletedEventSchema = eventGridEventOf(videoIndexingCompletedDataSchema);

export type VideoIndexingCompletedEvent = z.infer<typeof videoIndexingCompletedEventSchema>;
