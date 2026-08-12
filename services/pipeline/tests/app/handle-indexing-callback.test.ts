import { VIDEO_INDEXING_COMPLETED_EVENT_TYPE } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { handleIndexingCallback } from '../../src/app/handle-indexing-callback.js';
import { TEST_NOW, testDependencies } from '../support/deps.js';

describe('handleIndexingCallback', () => {
  it('republishes a terminal callback to the custom topic without trusting it', async () => {
    const deps = testDependencies();

    const result = await handleIndexingCallback(
      { id: 'vi-123', state: 'Processed', uploadId: 'upl-0001' },
      deps,
    );

    expect(result).toEqual({ status: 200, body: 'accepted' });
    expect(deps.events.published).toEqual([
      {
        id: 'evt-1',
        subject: 'videos/upl-0001',
        eventType: VIDEO_INDEXING_COMPLETED_EVENT_TYPE,
        eventTime: TEST_NOW.toISOString(),
        dataVersion: '1',
        data: { videoId: 'vi-123', state: 'Processed', uploadId: 'upl-0001' },
      },
    ]);
  });

  it('captures the raw query and the published event as diagnostics (plan §7)', async () => {
    const deps = testDependencies();

    await handleIndexingCallback({ id: 'vi-123', state: 'Failed', uploadId: 'upl-0001' }, deps);

    expect(deps.diagnostics.entries.has('upl-0001/indexing-callback/01-callback-query.json')).toBe(
      true,
    );
    expect(deps.diagnostics.entries.has('upl-0001/indexing-callback/02-published-event.json')).toBe(
      true,
    );
  });

  it('still publishes when the callback carries no uploadId (resolved later via Cosmos)', async () => {
    const deps = testDependencies();

    const result = await handleIndexingCallback({ id: 'vi-123', state: 'Processed' }, deps);

    expect(result.status).toBe(200);
    expect(deps.events.published[0]?.subject).toBe('videos/vi-123');
    expect(deps.events.published[0]?.data).toEqual({ videoId: 'vi-123', state: 'Processed' });
    expect(deps.diagnostics.entries.size).toBe(0);
  });

  it('ignores non-terminal progress callbacks', async () => {
    const deps = testDependencies();

    const result = await handleIndexingCallback({ id: 'vi-123', state: 'Processing' }, deps);

    expect(result).toEqual({ status: 200, body: 'ignored' });
    expect(deps.events.published).toHaveLength(0);
    expect(deps.logger.messages('warn')).toHaveLength(1);
  });

  it('ignores malformed callbacks with no video id', async () => {
    const deps = testDependencies();

    const result = await handleIndexingCallback({ state: 'Processed' }, deps);

    expect(result).toEqual({ status: 200, body: 'ignored' });
    expect(deps.events.published).toHaveLength(0);
  });

  it('propagates publish failures so the function reports 500 and alerts fire (plan §8)', async () => {
    const deps = testDependencies();
    deps.events.publishError = new Error('topic unreachable');

    await expect(
      handleIndexingCallback({ id: 'vi-123', state: 'Processed', uploadId: 'upl-0001' }, deps),
    ).rejects.toThrow('topic unreachable');

    expect(deps.diagnostics.entries.has('upl-0001/indexing-callback/01-callback-query.json')).toBe(
      true,
    );
    expect(deps.diagnostics.entries.has('upl-0001/indexing-callback/02-published-event.json')).toBe(
      false,
    );
  });
});
