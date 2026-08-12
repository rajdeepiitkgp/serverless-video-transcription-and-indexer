import { type CosmosClient } from '@azure/cosmos';
import { BlobServiceClient } from '@azure/storage-blob';
import { beforeAll, describe, expect, it } from 'vitest';

import { createHealthProbes } from './health-probes.js';

const connectionString = process.env.AZURITE_BLOB_CONNECTION_STRING;
if (connectionString === undefined) {
  throw new Error('AZURITE_BLOB_CONNECTION_STRING missing — Azurite global setup did not run');
}

const service = BlobServiceClient.fromConnectionString(connectionString);

const healthyCosmos = {
  getDatabaseAccount: () => Promise.resolve({}),
} as unknown as CosmosClient;

beforeAll(async () => {
  await service.getContainerClient('videos').createIfNotExists();
});

describe('createHealthProbes', () => {
  it('storage probe resolves against a live container (vs Azurite)', async () => {
    const probes = createHealthProbes(healthyCosmos, service, 'videos');

    await expect(probes.storage()).resolves.toBeUndefined();
  });

  it('storage probe rejects for a missing container', async () => {
    const probes = createHealthProbes(healthyCosmos, service, 'no-such-container');

    await expect(probes.storage()).rejects.toThrow();
  });

  it('cosmos probe reflects the account read outcome', async () => {
    const probes = createHealthProbes(healthyCosmos, service, 'videos');
    await expect(probes.cosmos()).resolves.toBeUndefined();

    const failing = createHealthProbes(
      {
        getDatabaseAccount: () => Promise.reject(new Error('unreachable')),
      } as unknown as CosmosClient,
      service,
      'videos',
    );
    await expect(failing.cosmos()).rejects.toThrow('unreachable');
  });
});
