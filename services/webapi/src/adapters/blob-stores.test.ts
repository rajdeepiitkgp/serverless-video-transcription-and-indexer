import { BlobServiceClient } from '@azure/storage-blob';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  downloadReadSasPolicy,
  playbackReadSasPolicy,
  uploadWriteSasPolicy,
} from '../core/sas-policy.js';
import { createBlobResultsStore, createVideoBlobStore } from './blob-stores.js';

// Provided by test-support/azurite-global-setup.ts (throwaway Azurite instance).
const connectionString = process.env.AZURITE_BLOB_CONNECTION_STRING;
if (connectionString === undefined) {
  throw new Error('AZURITE_BLOB_CONNECTION_STRING missing — Azurite global setup did not run');
}

const service = BlobServiceClient.fromConnectionString(connectionString);
const NOW = new Date();

beforeAll(async () => {
  await service.getContainerClient('videos').createIfNotExists();
  await service.getContainerClient('results').createIfNotExists();
});

async function putBlob(container: string, name: string, content: string): Promise<void> {
  await service
    .getContainerClient(container)
    .getBlockBlobClient(name)
    .uploadData(Buffer.from(content, 'utf8'));
}

describe('createVideoBlobStore (vs Azurite)', () => {
  const store = createVideoBlobStore(service, 'videos');

  it('issues a write SAS the browser can actually PUT through', async () => {
    const url = await store.createUploadSasUrl('upl-w/demo.mp4', uploadWriteSasPolicy(NOW));

    const put = await fetch(url, {
      method: 'PUT',
      headers: { 'x-ms-blob-type': 'BlockBlob', 'content-type': 'video/mp4' },
      body: 'fake-video-bytes',
    });
    expect(put.status).toBe(201);

    const stored = await service
      .getContainerClient('videos')
      .getBlobClient('upl-w/demo.mp4')
      .downloadToBuffer();
    expect(stored.toString('utf8')).toBe('fake-video-bytes');
  });

  it('rejects reads through the write-only SAS', async () => {
    await putBlob('videos', 'upl-w2/demo.mp4', 'secret');
    const url = await store.createUploadSasUrl('upl-w2/demo.mp4', uploadWriteSasPolicy(NOW));

    const get = await fetch(url);
    expect(get.status).toBe(403);
  });

  it('issues a read SAS that serves the blob', async () => {
    await putBlob('videos', 'upl-r/demo.mp4', 'playable-bytes');

    const url = await store.createReadSasUrl('upl-r/demo.mp4', playbackReadSasPolicy(NOW));
    const get = await fetch(url);

    expect(get.status).toBe(200);
    expect(await get.text()).toBe('playable-bytes');
  });

  it('stamps content-disposition onto download SAS responses', async () => {
    await putBlob('videos', 'upl-d/demo.mp4', 'download-bytes');

    const url = await store.createReadSasUrl('upl-d/demo.mp4', downloadReadSasPolicy(NOW), {
      contentDisposition: 'attachment; filename="demo.mp4"',
    });
    const get = await fetch(url);

    expect(get.headers.get('content-disposition')).toBe('attachment; filename="demo.mp4"');
  });

  it('deletes a blob and treats a second delete as a no-op', async () => {
    await putBlob('videos', 'upl-x/demo.mp4', 'bytes');

    await store.delete('upl-x/demo.mp4');
    await store.delete('upl-x/demo.mp4');

    expect(
      await service.getContainerClient('videos').getBlobClient('upl-x/demo.mp4').exists(),
    ).toBe(false);
  });
});

describe('createBlobResultsStore (vs Azurite)', () => {
  const store = createBlobResultsStore(service, 'results');

  it('reads a results blob as UTF-8', async () => {
    await putBlob('results', 'upl-1/transcript.vtt', 'WEBVTT\n');

    expect(await store.read('upl-1/transcript.vtt')).toBe('WEBVTT\n');
  });

  it('returns null for a missing blob', async () => {
    expect(await store.read('upl-1/missing.vtt')).toBeNull();
  });

  it('issues a read SAS for captions', async () => {
    await putBlob('results', 'upl-2/transcript.vtt', 'WEBVTT\ncaptions');

    const url = await store.createReadSasUrl('upl-2/transcript.vtt', playbackReadSasPolicy(NOW));
    const get = await fetch(url);

    expect(await get.text()).toBe('WEBVTT\ncaptions');
  });

  it('deletes every blob under a prefix, diagnostics included, and nothing else', async () => {
    await putBlob('results', 'upl-3/insights.json', '{}');
    await putBlob('results', 'upl-3/transcript.vtt', 'WEBVTT');
    await putBlob('results', 'upl-3/diagnostics/entry.json', '{}');
    await putBlob('results', 'upl-30/insights.json', '{"survivor":true}');

    await store.deletePrefix('upl-3/');

    const container = service.getContainerClient('results');
    expect(await container.getBlobClient('upl-3/insights.json').exists()).toBe(false);
    expect(await container.getBlobClient('upl-3/transcript.vtt').exists()).toBe(false);
    expect(await container.getBlobClient('upl-3/diagnostics/entry.json').exists()).toBe(false);
    expect(await container.getBlobClient('upl-30/insights.json').exists()).toBe(true);
  });
});
