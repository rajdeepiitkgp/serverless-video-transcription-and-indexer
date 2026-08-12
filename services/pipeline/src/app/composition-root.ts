import { randomUUID } from 'node:crypto';

import { CosmosClient } from '@azure/cosmos';
import { EventGridPublisherClient } from '@azure/eventgrid';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { createTrackingId } from '@vidx/shared';

import {
  createBlobDiagnosticsStore,
  createBlobResultsStore,
  createBlobUploadStore,
} from '../adapters/blob-stores.js';
import { createCosmosMetadataRepository } from '../adapters/cosmos-metadata-repository.js';
import { createDiscordNotificationPublisher } from '../adapters/discord-notification-publisher.js';
import { createEventGridPublisher } from '../adapters/event-grid-publisher.js';
import { createVideoIndexerRestClient } from '../adapters/video-indexer-rest-client.js';
import { type Clock } from '../ports/clock.js';
import { type IdGenerator } from '../ports/ids.js';
import { type Logger } from '../ports/logger.js';
import { loadPipelineConfig } from './config.js';
import { type PipelineDependencies } from './dependencies.js';

/**
 * Builds the real adapter graph once per worker (SDK clients cache connections and
 * AAD tokens) from app settings + the system-assigned managed identity
 * (DefaultAzureCredential also covers local `az login`). Excluded from coverage:
 * exercised by deploy and the M7 smoke test, not unit-testable offline.
 */
export const systemClock: Clock = { now: () => new Date() };

export const systemIds: IdGenerator = {
  eventId: () => randomUUID(),
  trackingId: createTrackingId,
};

let runtime: Omit<PipelineDependencies, 'logger'> | null = null;

function buildRuntime(): Omit<PipelineDependencies, 'logger'> {
  const config = loadPipelineConfig(process.env);
  const credential = new DefaultAzureCredential();

  const blobService = new BlobServiceClient(config.STORAGE_BLOB_ENDPOINT, credential);
  const cosmosContainer = new CosmosClient({
    endpoint: config.COSMOS_ENDPOINT,
    aadCredentials: credential,
  })
    .database(config.COSMOS_DATABASE)
    .container(config.COSMOS_CONTAINER);

  return {
    metadata: createCosmosMetadataRepository(cosmosContainer),
    uploads: createBlobUploadStore(blobService, config.VIDEOS_CONTAINER),
    results: createBlobResultsStore(blobService, config.RESULTS_CONTAINER),
    diagnostics: createBlobDiagnosticsStore(blobService, config.RESULTS_CONTAINER),
    videoIndexer: createVideoIndexerRestClient({
      credential,
      subscriptionId: config.VI_SUBSCRIPTION_ID,
      resourceGroup: config.VI_RESOURCE_GROUP,
      accountName: config.VI_ACCOUNT_NAME,
      accountId: config.VI_ACCOUNT_ID,
      location: config.VI_LOCATION,
      clock: systemClock,
      ...(config.VI_ARM_API_VERSION === undefined
        ? {}
        : { armApiVersion: config.VI_ARM_API_VERSION }),
    }),
    events: createEventGridPublisher(
      new EventGridPublisherClient(config.EVENT_GRID_TOPIC_ENDPOINT, 'EventGrid', credential),
    ),
    notifications: createDiscordNotificationPublisher(config.DISCORD_WEBHOOK_URL),
    clock: systemClock,
    ids: systemIds,
    options: {
      videosContainer: config.VIDEOS_CONTAINER,
      viCallbackUrl: config.VI_CALLBACK_URL,
      watchBaseUrl: config.WEB_BASE_URL,
      appInsightsUrl: config.APP_INSIGHTS_PORTAL_URL,
    },
  };
}

/** Full dependency bag for one invocation: shared runtime + the invocation's logger. */
export function pipelineDependencies(logger: Logger): PipelineDependencies {
  runtime ??= buildRuntime();
  return { ...runtime, logger };
}
