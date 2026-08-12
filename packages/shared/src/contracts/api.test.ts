import { describe, expect, it } from 'vitest';

import { detailedHealthResponseSchema, healthResponseSchema } from './health.js';
import { searchQuerySchema, searchResponseSchema } from './search.js';
import { statsResponseSchema } from './stats.js';
import { MAX_UPLOAD_BYTES, uploadRequestSchema, uploadResponseSchema } from './uploads.js';
import {
  deleteResponseSchema,
  downloadResponseSchema,
  transcriptDownloadQuerySchema,
  transcriptResponseSchema,
  videoDetailSchema,
  videoSummarySchema,
} from './videos.js';

describe('uploads contract', () => {
  const request = {
    fileName: 'product-demo.mp4',
    contentType: 'video/mp4',
    sizeBytes: 5_242_880,
  };

  it('accepts a valid upload request', () => {
    expect(uploadRequestSchema.parse(request)).toEqual(request);
  });

  it.each([
    [{ ...request, fileName: '' }, 'empty file name'],
    [{ ...request, contentType: '' }, 'empty content type'],
    [{ ...request, sizeBytes: 0 }, 'zero size'],
    [{ ...request, sizeBytes: -5 }, 'negative size'],
    [{ ...request, sizeBytes: 1.5 }, 'fractional size'],
    [{ ...request, sizeBytes: MAX_UPLOAD_BYTES + 1 }, 'oversize upload'],
  ])('rejects %j (%s)', (invalid) => {
    expect(uploadRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it('returns the SAS target and playability verdict', () => {
    const response = {
      uploadId: '8f7e6d5c-4b3a-42d1-9e0f-112233445566',
      uploadUrl: 'https://vidxprodst01.blob.core.windows.net/videos/8f7e6d5c/demo.mp4?sv=…&sig=…',
      blobPath: 'videos/8f7e6d5c-4b3a-42d1-9e0f-112233445566/product-demo.mp4',
      playable: false,
      expiresAt: '2026-08-12T10:15:00.000Z',
    };
    expect(uploadResponseSchema.parse(response)).toEqual(response);
  });
});

describe('videos contract', () => {
  it('summarizes a video for the list endpoint', () => {
    const summary = {
      id: '8f7e6d5c-4b3a-42d1-9e0f-112233445566',
      name: 'product-demo.mp4',
      status: 'Indexing',
      playable: true,
      uploadedBy: { userId: 'aad-user-1', userDetails: 'user@example.com' },
    };
    expect(videoSummarySchema.parse(summary)).toMatchObject(summary);
  });

  it('carries playback and captions URLs on the detail endpoint', () => {
    const detail = {
      id: '8f7e6d5c-4b3a-42d1-9e0f-112233445566',
      name: 'product-demo.mp4',
      status: 'Processed',
      playable: true,
      uploadedBy: { userId: 'aad-user-1', userDetails: 'user@example.com' },
      durationInSeconds: 127,
      keywords: ['product demo'],
      topics: ['Cloud Computing'],
      chapters: [{ title: 'Cloud Computing', startSeconds: 0, endSeconds: 45.2 }],
      playbackUrl: 'https://vidxprodst01.blob.core.windows.net/videos/8f7e6d5c/demo.mp4?sig=…',
      captionsUrl:
        'https://vidxprodst01.blob.core.windows.net/results/8f7e6d5c/transcript.vtt?sig=…',
      error: null,
    };
    expect(videoDetailSchema.parse(detail)).toMatchObject(detail);
  });

  it('serves the transcript as timestamped lines', () => {
    const transcript = {
      id: '8f7e6d5c-4b3a-42d1-9e0f-112233445566',
      name: 'product-demo.mp4',
      lines: [{ text: 'Welcome.', startSeconds: 1.2, endSeconds: 4.5 }],
    };
    expect(transcriptResponseSchema.parse(transcript)).toEqual(transcript);
  });

  it('validates transcript download formats', () => {
    expect(transcriptDownloadQuerySchema.parse({ format: 'vtt' })).toEqual({ format: 'vtt' });
    expect(transcriptDownloadQuerySchema.parse({ format: 'json' })).toEqual({ format: 'json' });
    expect(transcriptDownloadQuerySchema.parse({})).toEqual({ format: 'vtt' });
    expect(transcriptDownloadQuerySchema.safeParse({ format: 'srt' }).success).toBe(false);
  });

  it('describes download and delete responses', () => {
    const download = {
      url: 'https://vidxprodst01.blob.core.windows.net/videos/8f7e6d5c/demo.mp4?sig=…',
      fileName: 'product-demo.mp4',
      expiresAt: '2026-08-12T10:15:00.000Z',
    };
    expect(downloadResponseSchema.parse(download)).toEqual(download);
    expect(deleteResponseSchema.parse({ id: 'abc' })).toEqual({ id: 'abc' });
  });
});

describe('search contract', () => {
  it('requires a non-empty query', () => {
    expect(searchQuerySchema.parse({ q: 'architecture' })).toEqual({ q: 'architecture' });
    expect(searchQuerySchema.safeParse({ q: '' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({}).success).toBe(false);
  });

  it('returns matches with timestamps for transcript hits', () => {
    const response = {
      results: [
        {
          id: '8f7e6d5c-4b3a-42d1-9e0f-112233445566',
          name: 'product-demo.mp4',
          status: 'Processed',
          matches: [
            { field: 'transcript', snippet: '…the cloud architecture…', startSeconds: 5.14 },
            { field: 'keyword', snippet: 'cloud architecture' },
          ],
        },
      ],
    };
    expect(searchResponseSchema.parse(response)).toEqual(response);
    expect(
      searchResponseSchema.safeParse({
        results: [{ id: 'x', name: 'y', status: 'Processed', matches: [{ field: 'body' }] }],
      }).success,
    ).toBe(false);
  });
});

describe('stats contract', () => {
  it('feeds the dashboard tiles', () => {
    const stats = {
      totalVideos: 12,
      statusCounts: { Uploaded: 1, Indexing: 2, Processed: 8, Failed: 1 },
      processedRate: 0.667,
      failedRate: 0.083,
      avgIndexingSeconds: 312.4,
      minutesIndexedThisMonth: 42.5,
    };
    expect(statsResponseSchema.parse(stats)).toEqual(stats);
  });

  it('allows a null average before any video has processed', () => {
    const stats = {
      totalVideos: 0,
      statusCounts: { Uploaded: 0, Indexing: 0, Processed: 0, Failed: 0 },
      processedRate: 0,
      failedRate: 0,
      avgIndexingSeconds: null,
      minutesIndexedThisMonth: 0,
    };
    expect(statsResponseSchema.parse(stats)).toEqual(stats);
  });

  it('rejects rates outside 0..1', () => {
    expect(
      statsResponseSchema.safeParse({
        totalVideos: 1,
        statusCounts: { Uploaded: 0, Indexing: 0, Processed: 1, Failed: 0 },
        processedRate: 1.2,
        failedRate: 0,
        avgIndexingSeconds: 10,
        minutesIndexedThisMonth: 1,
      }).success,
    ).toBe(false);
  });
});

describe('health contract', () => {
  it('keeps the anonymous probe terse', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
    expect(Object.keys(healthResponseSchema.shape)).toEqual(['status']);
    expect(healthResponseSchema.safeParse({ status: 'fine' }).success).toBe(false);
  });

  it('details per-dependency checks for signed-in users', () => {
    const detailed = {
      status: 'degraded',
      checkedAt: '2026-08-12T09:12:33.000Z',
      dependencies: [
        { name: 'cosmos', status: 'ok', latencyMs: 12.5 },
        { name: 'storage', status: 'down', latencyMs: null },
      ],
    };
    expect(detailedHealthResponseSchema.parse(detailed)).toEqual(detailed);
  });
});
