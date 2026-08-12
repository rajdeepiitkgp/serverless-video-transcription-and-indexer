import * as z from 'zod';

import { eventGridEventOf } from './event-grid.js';

export const BLOB_CREATED_EVENT_TYPE = 'Microsoft.Storage.BlobCreated';

/**
 * The storage payload `ProcessVideoUpload` consumes. The subscription is filtered to
 * the `videos` container and PutBlob/PutBlockList APIs (plan §2), but the schema keeps
 * `api` open — filtering is the subscription's job, validation is ours.
 */
export const blobCreatedEventDataSchema = z
  .object({
    api: z.string().min(1),
    url: z.url(),
    contentType: z.string().optional(),
    contentLength: z.number().int().nonnegative().optional(),
    blobType: z.string().optional(),
  })
  .meta({ id: 'BlobCreatedEventData' });

export type BlobCreatedEventData = z.infer<typeof blobCreatedEventDataSchema>;

export const blobCreatedEventSchema = eventGridEventOf(blobCreatedEventDataSchema);

export type BlobCreatedEvent = z.infer<typeof blobCreatedEventSchema>;
