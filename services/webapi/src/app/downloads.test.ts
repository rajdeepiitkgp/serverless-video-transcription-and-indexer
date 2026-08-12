import { downloadResponseSchema, envelope, errorEnvelopeSchema } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { apiRequest, processedVideoDocument, videoDocument } from '../../test-support/builders.js';
import { testDependencies } from '../../test-support/deps.js';
import { handleDownloadTranscript, handleDownloadVideo } from './downloads.js';

describe('handleDownloadVideo', () => {
  it('issues an attachment read SAS for the source video (contract)', async () => {
    const deps = testDependencies();
    deps.videos.seed(processedVideoDocument());

    const result = await handleDownloadVideo(apiRequest({ params: { id: 'upl-0001' } }), deps);

    expect(result.status).toBe(200);
    const { data } = envelope(downloadResponseSchema).parse(result.jsonBody);
    expect(data).toEqual({
      url: 'https://fake.blob.core.windows.net/videos/upl-0001/demo.mp4?sig=fake-read-sas',
      fileName: 'demo.mp4',
      expiresAt: '2026-08-12T10:15:00.000Z',
    });
    expect(deps.videoBlobs.readSasRequests[0]).toMatchObject({
      blobName: 'upl-0001/demo.mp4',
      options: { contentDisposition: 'attachment; filename="demo.mp4"' },
    });
  });

  it('also serves failed videos — the source blob still exists', async () => {
    const deps = testDependencies();
    deps.videos.seed(videoDocument({ status: 'Failed', error: 'VI rejected the file' }));

    const result = await handleDownloadVideo(apiRequest({ params: { id: 'upl-0001' } }), deps);

    expect(result.status).toBe(200);
  });

  it('answers 409 while the blob may not have landed yet (status Uploaded)', async () => {
    const deps = testDependencies();
    deps.videos.seed(videoDocument());

    const result = await handleDownloadVideo(apiRequest({ params: { id: 'upl-0001' } }), deps);

    expect(result.status).toBe(409);
    expect(errorEnvelopeSchema.parse(result.jsonBody).error.code).toBe('not_ready');
  });

  it('answers 404 for an unknown id', async () => {
    const result = await handleDownloadVideo(
      apiRequest({ params: { id: 'nope' } }),
      testDependencies(),
    );
    expect(result.status).toBe(404);
  });
});

describe('handleDownloadTranscript', () => {
  function processedDeps(): ReturnType<typeof testDependencies> {
    const deps = testDependencies();
    deps.videos.seed(processedVideoDocument());
    deps.results.blobs.set('upl-0001/transcript.vtt', 'WEBVTT\n\n00:01.200 --> 00:04.500\nWelcome');
    return deps;
  }

  it('serves the pipeline-written VTT as an attachment by default', async () => {
    const result = await handleDownloadTranscript(
      apiRequest({ params: { id: 'upl-0001' } }),
      processedDeps(),
    );

    expect(result).toEqual({
      status: 200,
      body: 'WEBVTT\n\n00:01.200 --> 00:04.500\nWelcome',
      headers: {
        'content-type': 'text/vtt',
        'content-disposition': 'attachment; filename="demo.vtt"',
      },
    });
  });

  it('serves the timestamped lines as JSON when format=json', async () => {
    const result = await handleDownloadTranscript(
      apiRequest({ params: { id: 'upl-0001' }, query: { format: 'json' } }),
      processedDeps(),
    );

    expect(result.status).toBe(200);
    expect(result.headers).toEqual({
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="demo.json"',
    });
    expect(JSON.parse(result.body ?? '')).toEqual([
      { text: 'Welcome to the demo.', startSeconds: 1.2, endSeconds: 4.5 },
      { text: 'Uploading a video is easy.', startSeconds: 4.5, endSeconds: 9 },
    ]);
  });

  it('answers 400 for an unknown format', async () => {
    const result = await handleDownloadTranscript(
      apiRequest({ params: { id: 'upl-0001' }, query: { format: 'srt' } }),
      processedDeps(),
    );

    expect(result.status).toBe(400);
    expect(errorEnvelopeSchema.parse(result.jsonBody).error.code).toBe('validation_failed');
  });

  it('answers 409 before processing completes', async () => {
    const deps = testDependencies();
    deps.videos.seed(videoDocument());

    const result = await handleDownloadTranscript(apiRequest({ params: { id: 'upl-0001' } }), deps);

    expect(result.status).toBe(409);
  });

  it('answers 500 when the captions artifact is missing for a processed video', async () => {
    const deps = processedDeps();
    deps.results.blobs.clear();

    const result = await handleDownloadTranscript(apiRequest({ params: { id: 'upl-0001' } }), deps);

    expect(result.status).toBe(500);
    expect(errorEnvelopeSchema.parse(result.jsonBody).error.code).toBe('internal_error');
  });

  it('answers 404 for an unknown id', async () => {
    const result = await handleDownloadTranscript(
      apiRequest({ params: { id: 'nope' } }),
      testDependencies(),
    );
    expect(result.status).toBe(404);
  });
});
