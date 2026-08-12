import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadReplayBundle } from './bundle.js';
import { replayProcessResults } from './replay.js';

const bundlesDir = join(import.meta.dirname, '../../fixtures/bundles');
const replayedAt = new Date('2026-08-12T12:00:00.000Z');

describe('replay harness (plan §7 acceptance: runs a bundle)', () => {
  it('replays a processed bundle end-to-end from captured payloads', async () => {
    const bundle = await loadReplayBundle(join(bundlesDir, 'demo-processed'));
    const result = await replayProcessResults(bundle, replayedAt);

    expect(result.document?.status).toBe('Processed');
    expect(result.document?.durationInSeconds).toBe(127);
    expect(result.document?.keywords).toContain('product demo');
    expect(result.document?.transcript.length).toBeGreaterThan(0);

    expect([...result.resultsBlobs.keys()]).toEqual(
      expect.arrayContaining(['demo-0001/transcript.vtt', 'demo-0001/insights.json']),
    );
    // No thumbnail bytes in the bundle: replay proceeds without the attachment.
    expect(result.notifications[0]?.embeds[0].title).toBe('✅ product-demo.mp4');
    expect(result.notifications[0]?.attachment).toBeUndefined();
    expect(result.diagnosticsEntries).toContain(
      'demo-0001/process-results/04-composed-outputs.json',
    );
  });

  it('replays a failed bundle to the ❌ outcome', async () => {
    const bundle = await loadReplayBundle(join(bundlesDir, 'demo-failed'));
    const result = await replayProcessResults(bundle, replayedAt);

    expect(result.document?.status).toBe('Failed');
    expect(result.document?.error).toBe(
      'UnsupportedFileType: The file type is not supported for indexing. See the list of supported formats.',
    );
    expect(result.notifications[0]?.embeds[0].title).toBe('❌ corrupt-upload.mp4');
    expect(result.resultsBlobs.size).toBe(0);
  });

  it('synthesizes the completion event when the bundle lacks one', async () => {
    const bundle = await loadReplayBundle(join(bundlesDir, 'demo-processed'));
    const result = await replayProcessResults({ ...bundle, event: null }, replayedAt);

    expect(result.document?.status).toBe('Processed');
  });

  it('refuses a bundle whose document never reached Video Indexer', async () => {
    const bundle = await loadReplayBundle(join(bundlesDir, 'demo-processed'));
    const orphan = { ...bundle, event: null, document: { ...bundle.document, videoId: null } };

    await expect(replayProcessResults(orphan, replayedAt)).rejects.toThrow(
      'Bundle document has no videoId',
    );
  });

  it('rejects a directory that is not a bundle', async () => {
    await expect(loadReplayBundle(join(bundlesDir, 'nope'))).rejects.toThrow();
  });
});
