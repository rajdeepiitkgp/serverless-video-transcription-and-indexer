import { type VideoInsights } from '@vidx/shared';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { processVideoResults } from '../../src/app/process-video-results.js';
import { VideoIndexerRequestError } from '../../src/ports/video-indexer-client.js';
import { videoDocument } from '../support/builders.js';
import { TEST_NOW, testDependencies } from '../support/deps.js';

const viIndex = {
  id: 'vi-123',
  state: 'Processed',
  durationInSeconds: 127,
  summarizedInsights: { duration: { seconds: 127.04 }, thumbnailId: 'thumb-1' },
  videos: [
    {
      id: 'vi-123',
      state: 'Processed',
      thumbnailId: 'thumb-1',
      failureCode: 'None',
      failureMessage: '',
      insights: {
        duration: '0:02:07.04',
        transcript: [
          {
            text: 'Welcome to the product demo.',
            instances: [{ start: '0:00:01.2', end: '0:00:04.5' }],
          },
        ],
        keywords: [{ text: 'product demo', confidence: 0.9 }],
        topics: [
          {
            name: 'Cloud Computing',
            confidence: 0.8,
            instances: [{ start: '0:00:10', end: '0:01:00' }],
          },
        ],
      },
    },
  ],
};

const failedViIndex = {
  id: 'vi-123',
  state: 'Failed',
  videos: [
    {
      id: 'vi-123',
      state: 'Failed',
      failureCode: 'UnsupportedFileType',
      failureMessage: 'The file type is not supported for indexing.',
    },
  ],
};

const captions = 'WEBVTT\n\n00:00:01.200 --> 00:00:04.500\nWelcome to the product demo.\n';
const thumbnailBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);

function completedEvent(overrides: { state?: 'Processed' | 'Failed'; uploadId?: string } = {}) {
  const { state = 'Processed', uploadId } = overrides;
  return {
    id: 'evt-cb-1',
    subject: 'videos/upl-0001',
    eventType: 'VideoIndexing.Completed',
    eventTime: '2026-08-12T09:59:59.000Z',
    dataVersion: '1',
    data: { videoId: 'vi-123', state, ...(uploadId === undefined ? {} : { uploadId }) },
  };
}

function processedContent() {
  return { index: viIndex, captions, thumbnails: { 'thumb-1': thumbnailBytes } };
}

describe('processVideoResults', () => {
  it('persists artifacts, finalizes the document, and notifies with the thumbnail', async () => {
    const deps = testDependencies(processedContent());
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));

    await processVideoResults(completedEvent({ uploadId: 'upl-0001' }), deps);

    const vtt = deps.results.blobs.get('upl-0001/transcript.vtt');
    expect(vtt).toEqual({ body: captions, contentType: 'text/vtt' });

    const insightsBlob = deps.results.blobs.get('upl-0001/insights.json');
    expect(insightsBlob?.contentType).toBe('application/json');
    const insights = JSON.parse(insightsBlob?.body as string) as VideoInsights;
    expect(insights.keywords).toEqual(['product demo']);
    expect(insights.transcript).toEqual([
      { text: 'Welcome to the product demo.', startSeconds: 1.2, endSeconds: 4.5 },
    ]);

    const document = deps.metadata.documents.get('upl-0001');
    expect(document?.status).toBe('Processed');
    expect(document?.durationInSeconds).toBe(127);
    expect(document?.topics).toEqual(['Cloud Computing']);
    expect(document?.thumbnailId).toBe('thumb-1');
    expect(document?.processedAt).toBe(TEST_NOW.toISOString());
    expect(document?.trackingIds).toEqual({ upload: 'VXT-11111111', results: 'VXT-00000001' });

    const notification = deps.notifications.notifications[0];
    expect(notification?.embeds[0].title).toBe('✅ demo.mp4');
    expect(notification?.attachment?.data).toBe(thumbnailBytes);
  });

  it('captures event, raw index, captions, and composed outputs as diagnostics (plan §7)', async () => {
    const deps = testDependencies(processedContent());
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));

    await processVideoResults(completedEvent({ uploadId: 'upl-0001' }), deps);

    for (const entry of [
      'process-results/01-completed-event.json',
      'process-results/02-vi-index.json',
      'process-results/03-vi-captions.vtt',
      'process-results/04-composed-outputs.json',
    ]) {
      expect(deps.diagnostics.entries.has(`upl-0001/${entry}`), entry).toBe(true);
    }
  });

  it('resolves the document by videoId when the event carries no uploadId', async () => {
    const deps = testDependencies(processedContent());
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));

    await processVideoResults(completedEvent(), deps);

    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Processed');
  });

  it('warns and skips when no document matches', async () => {
    const deps = testDependencies(processedContent());

    await processVideoResults(completedEvent({ uploadId: 'upl-0001' }), deps);

    expect(deps.logger.messages('warn')).toHaveLength(1);
    expect(deps.results.blobs.size).toBe(0);
  });

  it('treats redeliveries for terminal documents as no-ops without calling VI', async () => {
    // No canned VI content: any VI call would reject and fail the test.
    const deps = testDependencies();
    deps.metadata.seed(videoDocument({ status: 'Processed', videoId: 'vi-123' }));

    await processVideoResults(completedEvent({ uploadId: 'upl-0001' }), deps);

    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Processed');
    expect(deps.notifications.notifications).toHaveLength(0);
  });

  it('fails the video with a ❌ embed when VI reports an indexing failure', async () => {
    const deps = testDependencies({ index: failedViIndex });
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));

    await processVideoResults(completedEvent({ state: 'Failed', uploadId: 'upl-0001' }), deps);

    const document = deps.metadata.documents.get('upl-0001');
    expect(document?.status).toBe('Failed');
    expect(document?.error).toBe(
      'UnsupportedFileType: The file type is not supported for indexing.',
    );
    expect(document?.trackingIds.results).toBe('VXT-00000001');

    const embed = deps.notifications.notifications[0]?.embeds[0];
    expect(embed?.title).toBe('❌ demo.mp4');
    expect(embed?.fields).toContainEqual({
      name: 'Failed stage',
      value: 'Results processing',
      inline: true,
    });
    expect(deps.results.blobs.size).toBe(0);
    expect(deps.diagnostics.entries.has('upl-0001/process-results/04-composed-outputs.json')).toBe(
      true,
    );
  });

  it('trusts the fetched index over the event: a clean index beats a Failed event state', async () => {
    const deps = testDependencies(processedContent());
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));

    await processVideoResults(completedEvent({ state: 'Failed', uploadId: 'upl-0001' }), deps);

    // The event said Failed but the authoritative index carries no failure —
    // the video still fails (state mismatch) with the fallback message.
    expect(deps.metadata.documents.get('upl-0001')?.error).toBe(
      'Video Indexer reported failure without details',
    );
  });

  it('fails the video when the index no longer matches our schema (deterministic)', async () => {
    const deps = testDependencies({ index: { totally: 'unexpected' } });
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));

    await processVideoResults(completedEvent({ uploadId: 'upl-0001' }), deps);

    const document = deps.metadata.documents.get('upl-0001');
    expect(document?.status).toBe('Failed');
    expect(deps.notifications.notifications[0]?.embeds[0].title).toBe('❌ demo.mp4');
  });

  it('rethrows transient VI failures without touching the document', async () => {
    const deps = testDependencies(processedContent());
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));
    deps.videoIndexer.indexError = new VideoIndexerRequestError('VI is down', 503);

    await expect(
      processVideoResults(completedEvent({ uploadId: 'upl-0001' }), deps),
    ).rejects.toThrow('VI is down');

    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Indexing');
    expect(deps.diagnostics.entries.has('upl-0001/process-results/99-error.json')).toBe(true);
  });

  it('processes without a thumbnail when the thumbnail fetch fails', async () => {
    const deps = testDependencies({ index: viIndex, captions });
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));

    await processVideoResults(completedEvent({ uploadId: 'upl-0001' }), deps);

    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Processed');
    const notification = deps.notifications.notifications[0];
    expect(notification?.attachment).toBeUndefined();
    expect(deps.logger.messages('warn')).toContain('Thumbnail fetch failed; notifying without it');
  });

  it('never lets a Discord failure fail the pipeline (plan §4)', async () => {
    const deps = testDependencies(processedContent());
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));
    deps.notifications.publishError = new Error('discord 500');

    await processVideoResults(completedEvent({ uploadId: 'upl-0001' }), deps);

    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Processed');
    expect(deps.logger.messages('warn')).toContain('Discord notification failed; continuing');
  });

  it('rejects a malformed event so Event Grid retries and dead-letters', async () => {
    const deps = testDependencies();
    await expect(processVideoResults({ nope: 1 }, deps)).rejects.toThrow(z.ZodError);
  });
});
