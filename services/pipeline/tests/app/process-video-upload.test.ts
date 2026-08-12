import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import { processVideoUpload } from '../../src/app/process-video-upload.js';
import { SAS_CLOCK_SKEW_MINUTES, VI_SOURCE_READ_SAS_HOURS } from '../../src/core/sas-policy.js';
import { VideoIndexerRequestError } from '../../src/ports/video-indexer-client.js';
import { videoDocument } from '../support/builders.js';
import { TEST_NOW, testDependencies } from '../support/deps.js';

function blobCreatedEvent(url = 'https://vidxsa.blob.core.windows.net/videos/upl-0001/demo.mp4') {
  return {
    id: 'eg-0001',
    subject: '/blobServices/default/containers/videos/blobs/upl-0001/demo.mp4',
    eventType: 'Microsoft.Storage.BlobCreated',
    eventTime: '2026-08-12T09:59:58.000Z',
    dataVersion: '1',
    data: {
      api: 'PutBlockList',
      url,
      contentType: 'video/mp4',
      contentLength: 1_048_576,
      blobType: 'BlockBlob',
    },
  };
}

describe('processVideoUpload', () => {
  it('submits the blob to Video Indexer and moves the document to Indexing', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument());

    await processVideoUpload(blobCreatedEvent(), deps);

    const submission = deps.videoIndexer.submissions[0];
    expect(submission?.name).toBe('demo.mp4');
    expect(submission?.externalId).toBe('upl-0001');
    expect(submission?.videoUrl).toContain('upl-0001/demo.mp4');
    const callback = new URL(submission?.callbackUrl ?? '');
    expect(callback.searchParams.get('uploadId')).toBe('upl-0001');
    expect(callback.searchParams.get('code')).toBe('function-key');

    const document = deps.metadata.documents.get('upl-0001');
    expect(document?.status).toBe('Indexing');
    expect(document?.videoId).toBe('vi-fake-1');
    expect(document?.submittedAt).toBe(TEST_NOW.toISOString());
  });

  it('requests a read SAS spanning the VI source-read window', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument());

    await processVideoUpload(blobCreatedEvent(), deps);

    const request = deps.uploads.requests[0];
    expect(request?.blobName).toBe('upl-0001/demo.mp4');
    expect(request?.policy.permissions).toBe('r');
    expect(request?.policy.startsOn).toEqual(
      new Date(TEST_NOW.getTime() - SAS_CLOCK_SKEW_MINUTES * 60_000),
    );
    expect(request?.policy.expiresOn).toEqual(
      new Date(TEST_NOW.getTime() + VI_SOURCE_READ_SAS_HOURS * 3_600_000),
    );
  });

  it('captures the triggering event and a secret-free submission record (plan §7)', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument());

    await processVideoUpload(blobCreatedEvent(), deps);

    expect(deps.diagnostics.entries.has('upl-0001/process-upload/01-blob-created-event.json')).toBe(
      true,
    );
    const submission = deps.diagnostics.entries.get(
      'upl-0001/process-upload/02-vi-submission.json',
    );
    expect(submission?.body).toContain('vi-fake-1');
    expect(submission?.body).not.toContain('sig=');
    expect(submission?.body).not.toContain('code=function-key');
  });

  it('rejects a malformed event so Event Grid retries and dead-letters', async () => {
    const deps = testDependencies();
    await expect(processVideoUpload({ nonsense: true }, deps)).rejects.toThrow(z.ZodError);
  });

  it('ignores blobs outside the {uploadId}/{fileName} layout', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument());

    await processVideoUpload(
      blobCreatedEvent('https://vidxsa.blob.core.windows.net/results/upl-0001/insights.json'),
      deps,
    );

    expect(deps.videoIndexer.submissions).toHaveLength(0);
    expect(deps.logger.messages('warn')).toHaveLength(1);
  });

  it('ignores blobs that never went through the API (no metadata document)', async () => {
    const deps = testDependencies();

    await processVideoUpload(blobCreatedEvent(), deps);

    expect(deps.videoIndexer.submissions).toHaveLength(0);
    expect(deps.logger.messages('warn')).toHaveLength(1);
  });

  it('treats a redelivery for an already-submitted document as a no-op', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument({ status: 'Indexing', videoId: 'vi-123' }));

    await processVideoUpload(blobCreatedEvent(), deps);

    expect(deps.videoIndexer.submissions).toHaveLength(0);
    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Indexing');
  });

  it('fails the video with a ❌ notification when VI rejects the submission (4xx)', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument());
    deps.videoIndexer.submitError = new VideoIndexerRequestError('unsupported format', 400);

    await processVideoUpload(blobCreatedEvent(), deps);

    const document = deps.metadata.documents.get('upl-0001');
    expect(document?.status).toBe('Failed');
    expect(document?.error).toBe('unsupported format');
    const embed = deps.notifications.notifications[0]?.embeds[0];
    expect(embed?.title).toBe('❌ demo.mp4');
    expect(embed?.fields).toContainEqual({
      name: 'Failed stage',
      value: 'Video Indexer submission',
      inline: true,
    });
    expect(embed?.fields).toContainEqual({
      name: 'Tracking ID',
      value: '`VXT-11111111`',
      inline: true,
    });
    expect(deps.diagnostics.entries.has('upl-0001/process-upload/99-error.json')).toBe(true);
  });

  it('rethrows transient VI errors without failing the video, so Event Grid redelivers', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument());
    deps.videoIndexer.submitError = new VideoIndexerRequestError('VI is down', 503);

    await expect(processVideoUpload(blobCreatedEvent(), deps)).rejects.toThrow('VI is down');

    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Uploaded');
    expect(deps.notifications.notifications).toHaveLength(0);
  });

  it('rethrows unknown errors as transient', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument());
    deps.videoIndexer.submitError = new Error('socket hang up');

    await expect(processVideoUpload(blobCreatedEvent(), deps)).rejects.toThrow('socket hang up');
    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Uploaded');
  });

  it('continues the pipeline when diagnostics capture fails (plan §7)', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument());
    deps.diagnostics.writeError = new Error('storage blip');

    await processVideoUpload(blobCreatedEvent(), deps);

    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Indexing');
    expect(deps.logger.messages('warn')).toContain('Diagnostics capture failed; continuing');
  });

  it('never lets a Discord failure mask the pipeline outcome', async () => {
    const deps = testDependencies();
    deps.metadata.seed(videoDocument());
    deps.videoIndexer.submitError = new VideoIndexerRequestError('bad request', 400);
    deps.notifications.publishError = new Error('discord 500');

    await processVideoUpload(blobCreatedEvent(), deps);

    expect(deps.metadata.documents.get('upl-0001')?.status).toBe('Failed');
    expect(deps.logger.messages('warn')).toContain('Discord notification failed; continuing');
  });
});
