import { envelope, errorEnvelopeSchema, videoDetailSchema, videoSummarySchema } from '@vidx/shared';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { handleGetVideo, handleListVideos } from '../../src/app/videos.js';
import { apiRequest, processedVideoDocument, videoDocument } from '../support/builders.js';
import { testDependencies } from '../support/deps.js';

describe('handleListVideos', () => {
  it('lists summaries, most recent first (contract)', async () => {
    const deps = testDependencies();
    deps.videos.seed(videoDocument({ id: 'upl-a', name: 'older.mp4' }));
    deps.videos.seed(processedVideoDocument({ id: 'upl-b', name: 'newer.mp4' }));

    const result = await handleListVideos(apiRequest(), deps);

    expect(result.status).toBe(200);
    const { data } = envelope(z.object({ videos: z.array(videoSummarySchema) })).parse(
      result.jsonBody,
    );
    expect(data.videos.map((video) => video.id)).toEqual(['upl-b', 'upl-a']);
  });

  it('returns an empty list for an empty library', async () => {
    const result = await handleListVideos(apiRequest(), testDependencies());
    expect(result.jsonBody).toEqual({ data: { videos: [] } });
  });
});

describe('handleGetVideo', () => {
  it('returns detail with playback and captions SAS URLs for a processed video (contract)', async () => {
    const deps = testDependencies();
    deps.videos.seed(processedVideoDocument());

    const result = await handleGetVideo(apiRequest({ params: { id: 'upl-0001' } }), deps);

    expect(result.status).toBe(200);
    const { data } = envelope(videoDetailSchema).parse(result.jsonBody);
    expect(data.playbackUrl).toBe(
      'https://fake.blob.core.windows.net/videos/upl-0001/demo.mp4?sig=fake-read-sas',
    );
    expect(data.captionsUrl).toBe(
      'https://fake.blob.core.windows.net/results/upl-0001/transcript.vtt?sig=fake-read-sas',
    );
    expect(data.keywords).toEqual(['transcription', 'azure']);
    expect(data.chapters).toHaveLength(1);
  });

  it('issues one-hour read SAS windows for playback and captions', async () => {
    const deps = testDependencies();
    deps.videos.seed(processedVideoDocument());

    await handleGetVideo(apiRequest({ params: { id: 'upl-0001' } }), deps);

    const window = {
      permissions: 'r',
      startsOn: new Date('2026-08-12T09:55:00.000Z'),
      expiresOn: new Date('2026-08-12T11:00:00.000Z'),
    };
    expect(deps.videoBlobs.readSasRequests).toEqual([
      { blobName: 'upl-0001/demo.mp4', policy: window, options: undefined },
    ]);
    expect(deps.results.readSasRequests).toEqual([
      { blobName: 'upl-0001/transcript.vtt', policy: window },
    ]);
  });

  it('keeps playback null for a processed but non-playable format', async () => {
    const deps = testDependencies();
    deps.videos.seed(processedVideoDocument({ playable: false }));

    const result = await handleGetVideo(apiRequest({ params: { id: 'upl-0001' } }), deps);

    const { data } = envelope(videoDetailSchema).parse(result.jsonBody);
    expect(data.playbackUrl).toBeNull();
    expect(data.captionsUrl).not.toBeNull();
    expect(deps.videoBlobs.readSasRequests).toHaveLength(0);
  });

  it('keeps both URLs null before processing completes', async () => {
    const deps = testDependencies();
    deps.videos.seed(videoDocument({ status: 'Indexing', videoId: 'vi-1' }));

    const result = await handleGetVideo(apiRequest({ params: { id: 'upl-0001' } }), deps);

    const { data } = envelope(videoDetailSchema).parse(result.jsonBody);
    expect(data.playbackUrl).toBeNull();
    expect(data.captionsUrl).toBeNull();
  });

  it('answers 404 with an error envelope for an unknown id', async () => {
    const result = await handleGetVideo(apiRequest({ params: { id: 'nope' } }), testDependencies());

    expect(result.status).toBe(404);
    expect(errorEnvelopeSchema.parse(result.jsonBody).error.code).toBe('not_found');
  });
});
