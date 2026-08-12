import { envelope, errorEnvelopeSchema, searchResponseSchema } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { apiRequest, processedVideoDocument, videoDocument } from '../../test-support/builders.js';
import { testDependencies } from '../../test-support/deps.js';
import { handleSearch } from './search.js';

describe('handleSearch', () => {
  it('returns matches with search-to-seek timestamps (contract)', async () => {
    const deps = testDependencies();
    deps.videos.seed(processedVideoDocument({ id: 'upl-a', name: 'azure-intro.mp4' }));
    deps.videos.seed(videoDocument({ id: 'upl-b', name: 'cats.mp4' }));

    const result = await handleSearch(apiRequest({ query: { q: 'uploading' } }), deps);

    expect(result.status).toBe(200);
    const { data } = envelope(searchResponseSchema).parse(result.jsonBody);
    expect(data.results).toEqual([
      {
        id: 'upl-a',
        name: 'azure-intro.mp4',
        status: 'Processed',
        matches: [
          { field: 'transcript', snippet: 'Uploading a video is easy.', startSeconds: 4.5 },
        ],
      },
    ]);
  });

  it('answers 400 when q is missing', async () => {
    const result = await handleSearch(apiRequest(), testDependencies());

    expect(result.status).toBe(400);
    expect(errorEnvelopeSchema.parse(result.jsonBody).error.code).toBe('validation_failed');
  });

  it('answers 400 when q exceeds 200 characters', async () => {
    const result = await handleSearch(
      apiRequest({ query: { q: 'x'.repeat(201) } }),
      testDependencies(),
    );

    expect(result.status).toBe(400);
  });

  it('logs the search query into the audit trail (plan §6)', async () => {
    const deps = testDependencies();

    await handleSearch(apiRequest({ query: { q: 'azure' } }), deps);

    const audit = deps.logger.entries.find((entry) => entry.message === 'Search');
    expect(audit?.properties).toMatchObject({ q: 'azure', userId: 'user-1' });
  });

  it('returns an empty result set when nothing matches', async () => {
    const deps = testDependencies();
    deps.videos.seed(videoDocument({ name: 'cats.mp4' }));

    const result = await handleSearch(apiRequest({ query: { q: 'dogs' } }), deps);

    expect(result.jsonBody).toEqual({ data: { results: [] } });
  });
});
