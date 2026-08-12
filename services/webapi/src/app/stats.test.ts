import { envelope, statsResponseSchema } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { apiRequest, processedVideoDocument, videoDocument } from '../../test-support/builders.js';
import { testDependencies } from '../../test-support/deps.js';
import { handleGetStats } from './stats.js';

describe('handleGetStats', () => {
  it('aggregates the library into the dashboard shape (contract)', async () => {
    const deps = testDependencies();
    deps.videos.seed(videoDocument({ id: 'upl-a' }));
    deps.videos.seed(processedVideoDocument({ id: 'upl-b' }));
    deps.videos.seed(videoDocument({ id: 'upl-c', status: 'Failed', error: 'boom' }));

    const result = await handleGetStats(apiRequest(), deps);

    expect(result.status).toBe(200);
    const { data } = envelope(statsResponseSchema).parse(result.jsonBody);
    expect(data).toEqual({
      totalVideos: 3,
      statusCounts: { Uploaded: 1, Indexing: 0, Processed: 1, Failed: 1 },
      processedRate: 1 / 3,
      failedRate: 1 / 3,
      avgIndexingSeconds: 600,
      minutesIndexedThisMonth: 62 / 60,
    });
  });

  it('answers zeroes for an empty library', async () => {
    const result = await handleGetStats(apiRequest(), testDependencies());

    const { data } = envelope(statsResponseSchema).parse(result.jsonBody);
    expect(data.totalVideos).toBe(0);
    expect(data.avgIndexingSeconds).toBeNull();
  });
});
