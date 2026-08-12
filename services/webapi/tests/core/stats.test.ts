import { describe, expect, it } from 'vitest';

import { computeStats } from '../../src/core/stats.js';
import { processedVideoDocument, videoDocument } from '../support/builders.js';

const NOW = new Date('2026-08-12T10:00:00.000Z');

describe('computeStats', () => {
  it('returns zeroes for an empty library', () => {
    expect(computeStats([], NOW)).toEqual({
      totalVideos: 0,
      statusCounts: { Uploaded: 0, Indexing: 0, Processed: 0, Failed: 0 },
      processedRate: 0,
      failedRate: 0,
      avgIndexingSeconds: null,
      minutesIndexedThisMonth: 0,
    });
  });

  it('counts statuses and computes terminal-state rates', () => {
    const documents = [
      videoDocument({ id: 'a' }),
      videoDocument({ id: 'b', status: 'Indexing', videoId: 'vi-b' }),
      processedVideoDocument({ id: 'c' }),
      processedVideoDocument({ id: 'd' }),
      videoDocument({ id: 'e', status: 'Failed', error: 'boom' }),
    ];

    const stats = computeStats(documents, NOW);

    expect(stats.totalVideos).toBe(5);
    expect(stats.statusCounts).toEqual({ Uploaded: 1, Indexing: 1, Processed: 2, Failed: 1 });
    expect(stats.processedRate).toBeCloseTo(0.4);
    expect(stats.failedRate).toBeCloseTo(0.2);
  });

  it('averages indexing time over processed videos with both timestamps', () => {
    const documents = [
      processedVideoDocument({
        id: 'a',
        submittedAt: '2026-08-12T09:00:00.000Z',
        processedAt: '2026-08-12T09:10:00.000Z', // 600s
      }),
      processedVideoDocument({
        id: 'b',
        submittedAt: '2026-08-12T09:00:00.000Z',
        processedAt: '2026-08-12T09:05:00.000Z', // 300s
      }),
    ];

    expect(computeStats(documents, NOW).avgIndexingSeconds).toBe(450);
  });

  it('ignores nonsensical negative indexing durations', () => {
    const document = processedVideoDocument({
      submittedAt: '2026-08-12T10:00:00.000Z',
      processedAt: '2026-08-12T09:00:00.000Z',
    });

    expect(computeStats([document], NOW).avgIndexingSeconds).toBeNull();
  });

  it('sums minutes indexed in the current UTC month only', () => {
    const documents = [
      processedVideoDocument({
        id: 'this-month',
        durationInSeconds: 120,
        processedAt: '2026-08-01T00:00:00.000Z',
      }),
      processedVideoDocument({
        id: 'last-month',
        durationInSeconds: 600,
        processedAt: '2026-07-31T23:59:59.000Z',
      }),
      processedVideoDocument({
        id: 'last-year-same-month',
        durationInSeconds: 600,
        processedAt: '2025-08-12T10:00:00.000Z',
      }),
    ];

    expect(computeStats(documents, NOW).minutesIndexedThisMonth).toBe(2);
  });

  it('skips a Processed document with no processedAt (tolerant reads)', () => {
    const document = videoDocument({
      status: 'Processed',
      videoId: 'vi-1',
      durationInSeconds: 600,
    });

    const stats = computeStats([document], NOW);

    expect(stats.statusCounts.Processed).toBe(1);
    expect(stats.avgIndexingSeconds).toBeNull();
    expect(stats.minutesIndexedThisMonth).toBe(0);
  });

  it('excludes a Processed document with no submittedAt from the indexing average', () => {
    const document = videoDocument({
      status: 'Processed',
      videoId: 'vi-1',
      durationInSeconds: 60,
      processedAt: '2026-08-12T09:00:00.000Z',
    });

    const stats = computeStats([document], NOW);

    expect(stats.avgIndexingSeconds).toBeNull();
    expect(stats.minutesIndexedThisMonth).toBe(1);
  });

  it('treats a processed video with no duration as zero minutes', () => {
    const document = processedVideoDocument({ processedAt: '2026-08-12T09:00:00.000Z' });
    const noDuration = { ...document } as { durationInSeconds?: number };
    delete noDuration.durationInSeconds;

    expect(
      computeStats([videoDocument({ ...noDuration, status: 'Processed' })], NOW)
        .minutesIndexedThisMonth,
    ).toBe(0);
  });
});
