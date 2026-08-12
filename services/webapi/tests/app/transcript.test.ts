import { envelope, errorEnvelopeSchema, transcriptResponseSchema } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { handleGetTranscript } from '../../src/app/transcript.js';
import { apiRequest, processedVideoDocument, videoDocument } from '../support/builders.js';
import { testDependencies } from '../support/deps.js';

describe('handleGetTranscript', () => {
  it('returns the timestamped lines for a processed video (contract)', async () => {
    const deps = testDependencies();
    deps.videos.seed(processedVideoDocument());

    const result = await handleGetTranscript(apiRequest({ params: { id: 'upl-0001' } }), deps);

    expect(result.status).toBe(200);
    const { data } = envelope(transcriptResponseSchema).parse(result.jsonBody);
    expect(data.lines).toHaveLength(2);
    expect(data.lines[0]).toEqual({
      text: 'Welcome to the demo.',
      startSeconds: 1.2,
      endSeconds: 4.5,
    });
  });

  it('answers 409 not_ready before processing completes', async () => {
    const deps = testDependencies();
    deps.videos.seed(videoDocument({ status: 'Indexing', videoId: 'vi-1' }));

    const result = await handleGetTranscript(apiRequest({ params: { id: 'upl-0001' } }), deps);

    expect(result.status).toBe(409);
    expect(errorEnvelopeSchema.parse(result.jsonBody).error.code).toBe('not_ready');
  });

  it('answers 404 for an unknown id', async () => {
    const result = await handleGetTranscript(
      apiRequest({ params: { id: 'nope' } }),
      testDependencies(),
    );

    expect(result.status).toBe(404);
  });
});
