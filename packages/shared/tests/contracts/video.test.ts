import { describe, expect, it } from 'vitest';

import { videoDocumentSchema, videoStatusSchema } from '../../src/contracts/video.js';

const processedDocument = {
  id: '8f7e6d5c-4b3a-42d1-9e0f-112233445566',
  videoId: 'b3f1a2c4d5',
  schemaVersion: 1,
  name: 'product-demo.mp4',
  blobPath: 'videos/8f7e6d5c-4b3a-42d1-9e0f-112233445566/product-demo.mp4',
  playable: true,
  status: 'Processed',
  uploadedBy: { userId: 'aad-user-1', userDetails: 'user@example.com' },
  durationInSeconds: 127,
  keywords: ['product demo', 'cloud architecture'],
  topics: ['Cloud Computing'],
  transcript: [{ text: 'Welcome to the product demo.', startSeconds: 1.2, endSeconds: 4.5 }],
  chapters: [{ title: 'Cloud Computing', startSeconds: 0, endSeconds: 45.2 }],
  thumbnailId: '9c2f6a1e-8f2b-4a6f-b1de-4a1b9c0d2e3f',
  resultsPrefix: 'results/8f7e6d5c-4b3a-42d1-9e0f-112233445566/',
  trackingIds: { upload: 'VXT-a1b2c3d4', results: 'VXT-e5f6a7b8' },
  submittedAt: '2026-08-10T14:03:22.000Z',
  processedAt: '2026-08-10T14:09:41.000Z',
  error: null,
};

describe('videoStatusSchema', () => {
  it('accepts only the four pipeline states', () => {
    for (const status of ['Uploaded', 'Indexing', 'Processed', 'Failed']) {
      expect(videoStatusSchema.parse(status)).toBe(status);
    }
    expect(videoStatusSchema.safeParse('Deleted').success).toBe(false);
  });
});

describe('videoDocumentSchema', () => {
  it('round-trips a full Processed document', () => {
    expect(videoDocumentSchema.parse(processedDocument)).toEqual(processedDocument);
  });

  it('accepts a freshly Uploaded document with insight fields absent (tolerant reads)', () => {
    const uploaded = videoDocumentSchema.parse({
      id: '8f7e6d5c-4b3a-42d1-9e0f-112233445566',
      videoId: null,
      schemaVersion: 1,
      name: 'product-demo.mp4',
      blobPath: 'videos/8f7e6d5c-4b3a-42d1-9e0f-112233445566/product-demo.mp4',
      playable: true,
      status: 'Uploaded',
      uploadedBy: { userId: 'aad-user-1', userDetails: 'user@example.com' },
      resultsPrefix: 'results/8f7e6d5c-4b3a-42d1-9e0f-112233445566/',
      trackingIds: { upload: 'VXT-a1b2c3d4' },
    });

    expect(uploaded.keywords).toEqual([]);
    expect(uploaded.topics).toEqual([]);
    expect(uploaded.transcript).toEqual([]);
    expect(uploaded.chapters).toEqual([]);
    expect(uploaded.error).toBeNull();
  });

  it('pins schemaVersion to 1', () => {
    expect(videoDocumentSchema.safeParse({ ...processedDocument, schemaVersion: 2 }).success).toBe(
      false,
    );
  });

  it('rejects unknown statuses and malformed tracking ids', () => {
    expect(videoDocumentSchema.safeParse({ ...processedDocument, status: 'Queued' }).success).toBe(
      false,
    );
    expect(
      videoDocumentSchema.safeParse({
        ...processedDocument,
        trackingIds: { upload: 'nope' },
      }).success,
    ).toBe(false);
  });
});
