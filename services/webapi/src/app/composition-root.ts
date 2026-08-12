import { randomUUID } from 'node:crypto';

import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { createTrackingId } from '@vidx/shared';

import { createBlobResultsStore, createVideoBlobStore } from '../adapters/blob-stores.js';
import { createCosmosVideoRepository } from '../adapters/cosmos-video-repository.js';
import { createHealthProbes } from '../adapters/health-probes.js';
import { type Clock } from '../ports/clock.js';
import { type IdGenerator } from '../ports/ids.js';
import { type Logger } from '../ports/logger.js';
import { loadWebApiConfig } from './config.js';
import { type WebApiDependencies } from './dependencies.js';

/**
 * Builds the real adapter graph once per worker (SDK clients cache connections and
 * AAD tokens) from app settings + the system-assigned managed identity
 * (DefaultAzureCredential also covers local `az login`). Excluded from coverage:
 * exercised by deploy and the M7 smoke test, not unit-testable offline.
 */
export const systemClock: Clock = { now: () => new Date() };

export const systemIds: IdGenerator = {
  uploadId: () => randomUUID(),
  trackingId: createTrackingId,
};

let runtime: Omit<WebApiDependencies, 'logger'> | null = null;

function buildRuntime(): Omit<WebApiDependencies, 'logger'> {
  const config = loadWebApiConfig(process.env);
  const credential = new DefaultAzureCredential();

  const blobService = new BlobServiceClient(config.STORAGE_BLOB_ENDPOINT, credential);
  const cosmosClient = new CosmosClient({
    endpoint: config.COSMOS_ENDPOINT,
    aadCredentials: credential,
  });
  const cosmosContainer = cosmosClient
    .database(config.COSMOS_DATABASE)
    .container(config.COSMOS_CONTAINER);

  return {
    videos: createCosmosVideoRepository(cosmosContainer),
    videoBlobs: createVideoBlobStore(blobService, config.VIDEOS_CONTAINER),
    results: createBlobResultsStore(blobService, config.RESULTS_CONTAINER),
    probes: createHealthProbes(cosmosClient, blobService, config.VIDEOS_CONTAINER),
    clock: systemClock,
    ids: systemIds,
    options: {
      videosContainer: config.VIDEOS_CONTAINER,
      resultsContainer: config.RESULTS_CONTAINER,
      healthProbeTimeoutMs: config.HEALTH_PROBE_TIMEOUT_MS,
    },
  };
}

/** Full dependency bag for one invocation: shared runtime + the invocation's logger. */
export function webApiDependencies(logger: Logger): WebApiDependencies {
  runtime ??= buildRuntime();
  return { ...runtime, logger };
}
