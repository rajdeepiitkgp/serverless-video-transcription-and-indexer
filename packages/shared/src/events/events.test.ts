import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import {
  BLOB_CREATED_EVENT_TYPE,
  blobCreatedEventDataSchema,
  blobCreatedEventSchema,
} from './blob-created.js';
import { eventGridEventOf, eventGridEventSchema } from './event-grid.js';
import {
  VIDEO_INDEXING_COMPLETED_EVENT_TYPE,
  videoIndexingCompletedDataSchema,
  videoIndexingCompletedEventSchema,
} from './video-indexing.js';

const blobCreatedEvent = {
  topic:
    '/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-vidx-prod/providers/Microsoft.Storage/storageAccounts/vidxprodst01',
  subject:
    '/blobServices/default/containers/videos/blobs/8f7e6d5c-4b3a-42d1-9e0f-112233445566/product-demo.mp4',
  eventType: 'Microsoft.Storage.BlobCreated',
  id: 'c2d4e6f8-1111-4222-8333-944444444444',
  data: {
    api: 'PutBlockList',
    clientRequestId: 'a1b2c3d4-0000-4000-8000-000000000001',
    requestId: 'b2c3d4e5-0000-4000-8000-000000000002',
    eTag: '0x8DD1234567890AB',
    contentType: 'video/mp4',
    contentLength: 5242880,
    blobType: 'BlockBlob',
    accessTier: 'Default',
    url: 'https://vidxprodst01.blob.core.windows.net/videos/8f7e6d5c-4b3a-42d1-9e0f-112233445566/product-demo.mp4',
    sequencer: '00000000000000000000000000015a2b000000000001d0f2',
    storageDiagnostics: { batchId: 'd4e5f6a7-0000-4000-8000-000000000003' },
  },
  dataVersion: '',
  metadataVersion: '1',
  eventTime: '2026-08-12T09:12:33.1234567Z',
};

describe('event grid envelope', () => {
  it('parses a real Event Grid schema event', () => {
    const parsed = eventGridEventSchema.parse(blobCreatedEvent);
    expect(parsed.eventType).toBe(BLOB_CREATED_EVENT_TYPE);
  });

  it('types the data payload via eventGridEventOf', () => {
    const schema = eventGridEventOf(z.object({ n: z.number() }));
    const parsed = schema.parse({ ...blobCreatedEvent, data: { n: 1 } });
    expect(parsed.data.n).toBe(1);
    expect(schema.safeParse({ ...blobCreatedEvent, data: { n: 'x' } }).success).toBe(false);
  });

  it('rejects events without required envelope fields', () => {
    expect(eventGridEventSchema.safeParse({ data: {} }).success).toBe(false);
  });
});

describe('BlobCreated event', () => {
  it('parses the storage payload the pipeline consumes', () => {
    const parsed = blobCreatedEventSchema.parse(blobCreatedEvent);
    expect(parsed.data.api).toBe('PutBlockList');
    expect(parsed.data.url).toContain('/videos/');
    expect(parsed.data.contentLength).toBe(5242880);
  });

  it('tolerates omitted optional fields but requires api and url', () => {
    expect(
      blobCreatedEventDataSchema.parse({
        api: 'PutBlob',
        url: 'https://vidxprodst01.blob.core.windows.net/videos/x/y.mp4',
      }),
    ).toMatchObject({ api: 'PutBlob' });
    expect(blobCreatedEventDataSchema.safeParse({ api: 'PutBlob' }).success).toBe(false);
    expect(blobCreatedEventDataSchema.safeParse({ url: 'not a url', api: 'PutBlob' }).success).toBe(
      false,
    );
  });
});

describe('VideoIndexing.Completed event', () => {
  it('carries the VI video id and terminal state', () => {
    const data = { videoId: 'b3f1a2c4d5', state: 'Processed' };
    expect(videoIndexingCompletedDataSchema.parse(data)).toEqual(data);

    const event = videoIndexingCompletedEventSchema.parse({
      id: 'e5f6a7b8-1111-4222-8333-944444444444',
      subject: 'videos/b3f1a2c4d5',
      eventType: VIDEO_INDEXING_COMPLETED_EVENT_TYPE,
      eventTime: '2026-08-12T09:30:00Z',
      dataVersion: '1',
      data: { videoId: 'b3f1a2c4d5', state: 'Failed', uploadId: '8f7e6d5c' },
    });
    expect(event.data.state).toBe('Failed');
    expect(event.data.uploadId).toBe('8f7e6d5c');
  });

  it('rejects non-terminal states — the callback republishes only completions', () => {
    expect(
      videoIndexingCompletedDataSchema.safeParse({ videoId: 'x', state: 'Processing' }).success,
    ).toBe(false);
    expect(videoIndexingCompletedDataSchema.safeParse({ state: 'Processed' }).success).toBe(false);
  });
});
