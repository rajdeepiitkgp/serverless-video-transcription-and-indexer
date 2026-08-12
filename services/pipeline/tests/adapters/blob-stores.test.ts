import { BlobServiceClient } from '@azure/storage-blob';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  createBlobDiagnosticsStore,
  createBlobResultsStore,
  createBlobUploadStore,
} from '../../src/adapters/blob-stores.js';
import { viSourceReadSasPolicy } from '../../src/core/sas-policy.js';

// Provided by tests/support/azurite-global-setup.ts (throwaway Azurite instance).
const connectionString = process.env.AZURITE_BLOB_CONNECTION_STRING;
if (connectionString === undefined) {
  throw new Error('AZURITE_BLOB_CONNECTION_STRING missing — Azurite global setup did not run');
}

const service = BlobServiceClient.fromConnectionString(connectionString);

async function readBlob(
  container: string,
  name: string,
): Promise<{ body: string; contentType: string | undefined }> {
  const blob = service.getContainerClient(container).getBlobClient(name);
  const buffer = await blob.downloadToBuffer();
  const properties = await blob.getProperties();
  return { body: buffer.toString('utf8'), contentType: properties.contentType };
}

beforeAll(async () => {
  await service.getContainerClient('videos').createIfNotExists();
  await service.getContainerClient('results').createIfNotExists();
});

describe('createBlobResultsStore (vs Azurite)', () => {
  it('writes string bodies with the given content type', async () => {
    const store = createBlobResultsStore(service, 'results');

    await store.write('upl-1/insights.json', '{"keywords":[]}', 'application/json');

    expect(await readBlob('results', 'upl-1/insights.json')).toEqual({
      body: '{"keywords":[]}',
      contentType: 'application/json',
    });
  });

  it('writes binary bodies', async () => {
    const store = createBlobResultsStore(service, 'results');

    await store.write('upl-1/thumb.jpg', new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg');

    const blob = await service
      .getContainerClient('results')
      .getBlobClient('upl-1/thumb.jpg')
      .downloadToBuffer();
    expect([...blob]).toEqual([0xff, 0xd8, 0xff]);
  });

  it('overwrites an existing blob (idempotent redeliveries rewrite artifacts)', async () => {
    const store = createBlobResultsStore(service, 'results');

    await store.write('upl-1/transcript.vtt', 'WEBVTT\n\nfirst', 'text/vtt');
    await store.write('upl-1/transcript.vtt', 'WEBVTT\n\nsecond', 'text/vtt');

    expect((await readBlob('results', 'upl-1/transcript.vtt')).body).toBe('WEBVTT\n\nsecond');
  });
});

describe('createBlobDiagnosticsStore (vs Azurite)', () => {
  it('lands entries under {uploadId}/diagnostics/ (plan §7)', async () => {
    const store = createBlobDiagnosticsStore(service, 'results');

    await store.write(
      'upl-2',
      'process-upload/01-blob-created-event.json',
      '{}',
      'application/json',
    );

    expect(
      await readBlob('results', 'upl-2/diagnostics/process-upload/01-blob-created-event.json'),
    ).toEqual({ body: '{}', contentType: 'application/json' });
  });
});

describe('createBlobUploadStore (vs Azurite)', () => {
  it('issues a read SAS URL that actually reads the private blob', async () => {
    await service
      .getContainerClient('videos')
      .getBlockBlobClient('upl-3/demo.mp4')
      .uploadData(Buffer.from('fake-video-bytes'));
    const store = createBlobUploadStore(service, 'videos');

    const sasUrl = await store.createReadSasUrl(
      'upl-3/demo.mp4',
      viSourceReadSasPolicy(new Date()),
    );
    const response = await fetch(sasUrl);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('fake-video-bytes');
  });

  it('signs with a user delegation key when the client has no shared key (production path)', async () => {
    const delegationKey = {
      signedObjectId: '00000000-0000-0000-0000-000000000001',
      signedTenantId: '00000000-0000-0000-0000-000000000002',
      signedStartsOn: new Date('2026-08-12T09:55:00Z'),
      signedExpiresOn: new Date('2026-08-12T16:00:00Z'),
      signedService: 'b',
      signedVersion: '2025-01-05',
      value: Buffer.from('fake-user-delegation-key-material').toString('base64'),
    };
    const requestedKeyWindows: { startsOn: Date; expiresOn: Date }[] = [];
    const stubService = {
      accountName: 'prodaccount',
      credential: {},
      getContainerClient: (container: string) => ({
        getBlobClient: (blob: string) => ({
          url: `https://prodaccount.blob.core.windows.net/${container}/${blob}`,
        }),
      }),
      getUserDelegationKey: (startsOn: Date, expiresOn: Date) => {
        requestedKeyWindows.push({ startsOn, expiresOn });
        return Promise.resolve(delegationKey);
      },
    } as unknown as BlobServiceClient;
    const store = createBlobUploadStore(stubService, 'videos');
    const policy = viSourceReadSasPolicy(new Date('2026-08-12T10:00:00Z'));

    const sasUrl = await store.createReadSasUrl('upl-4/demo.mp4', policy);

    expect(sasUrl).toContain('https://prodaccount.blob.core.windows.net/videos/upl-4/demo.mp4?');
    // skoid marks a user-delegation SAS; sig proves it was actually signed.
    expect(sasUrl).toContain('skoid=00000000-0000-0000-0000-000000000001');
    expect(sasUrl).toContain('sig=');
    expect(sasUrl).toContain('sp=r');
    expect(requestedKeyWindows).toEqual([
      { startsOn: policy.startsOn, expiresOn: policy.expiresOn },
    ]);
  });
});
