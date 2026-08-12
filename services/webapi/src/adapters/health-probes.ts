import { type CosmosClient } from '@azure/cosmos';
import { type BlobServiceClient } from '@azure/storage-blob';

import { type HealthProbes } from '../ports/health-probes.js';

/**
 * Cheapest authenticated round-trips that prove each dependency is reachable with
 * the app's managed identity: a Cosmos account read and a container-properties read
 * (covered by Storage Blob Data Contributor). Timeouts and status classification
 * live in the app layer.
 */
export function createHealthProbes(
  cosmos: CosmosClient,
  blobService: BlobServiceClient,
  videosContainer: string,
): HealthProbes {
  return {
    async cosmos(): Promise<void> {
      await cosmos.getDatabaseAccount();
    },
    async storage(): Promise<void> {
      await blobService.getContainerClient(videosContainer).getProperties();
    },
  };
}
