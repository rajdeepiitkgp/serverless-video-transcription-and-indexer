// Post-deploy smoke test (plan §3/§9 as amended by ADR-0005): checks /api/health
// through the SWA domain, seeds the upload's `Uploaded` metadata document in Cosmos
// (the pipeline ignores blobs that didn't arrive through the API — seventh Deploy
// all), uploads a sample clip into the videos container, and polls the results
// container until the pipeline writes insights.json + transcript.vtt (i.e. the video
// reached Processed end-to-end: BlobCreated → VI → callback → results → Cosmos).
// The uploaded clip is deliberately left in place — it becomes the library's first
// entry and M7's playable-with-CC check reuses it.
//
// Auth: DefaultAzureCredential (az login locally, OIDC via azure/login in CI). The
// deploy identity holds Storage Blob Data Contributor (bootstrap-azure.sh) and
// Cosmos Data Contributor (rbac.bicep via deployer(), ADR-0005), so it needs no key
// or SAS anywhere. Runs directly under Node 24 (type stripping).
//
// Env: SMOKE_STORAGE_ACCOUNT (required), SMOKE_SWA_HOSTNAME (required),
//      SMOKE_COSMOS_ENDPOINT (required), SMOKE_VIDEO_FILE (required, path to a
//      small clip), SMOKE_TIMEOUT_MINUTES (default 20),
//      SMOKE_POLL_SECONDS (default 15), SMOKE_HEALTH_RETRY_MINUTES (default 5).

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`smoke: missing required env var ${name}`);
    process.exit(2);
  }
  return value;
};

const storageAccount = requireEnv('SMOKE_STORAGE_ACCOUNT');
const swaHostname = requireEnv('SMOKE_SWA_HOSTNAME');
const cosmosEndpoint = requireEnv('SMOKE_COSMOS_ENDPOINT');
const videoFile = requireEnv('SMOKE_VIDEO_FILE');
const timeoutMinutes = Number(process.env['SMOKE_TIMEOUT_MINUTES'] ?? '20');
const pollSeconds = Number(process.env['SMOKE_POLL_SECONDS'] ?? '15');
const healthRetryMinutes = Number(process.env['SMOKE_HEALTH_RETRY_MINUTES'] ?? '5');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Retried: deploy-all runs smoke seconds after the webapi re-deploy, and the B1
// site container takes a minute or two to come back — the SWA→backend path
// serves 503 until it does (sixth Deploy all failed exactly there).
const checkHealth = async (): Promise<void> => {
  const url = `https://${swaHostname}/api/health`;
  const deadline = Date.now() + healthRetryMinutes * 60_000;
  for (;;) {
    let failure: string;
    try {
      const response = await fetch(url);
      let status: string | undefined;
      try {
        const body = (await response.json()) as { data?: { status?: string } };
        status = body.data?.status;
      } catch {
        // SWA serves non-JSON error pages while the linked backend restarts.
      }
      console.log(
        `smoke: GET ${url} → ${String(response.status)} (status: ${status ?? 'unknown'})`,
      );
      if (response.ok) {
        return;
      }
      failure = `health endpoint returned ${String(response.status)}`;
    } catch (error) {
      failure = `health fetch failed: ${error instanceof Error ? error.message : String(error)}`;
      console.log(`smoke: GET ${url} → ${failure}`);
    }
    if (Date.now() > deadline) {
      throw new Error(
        `${failure} after retrying for ${String(healthRetryMinutes)}m — SWA or linked backend is down`,
      );
    }
    await sleep(10_000);
  }
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  await checkHealth();

  const credential = new DefaultAzureCredential();
  const blobService = new BlobServiceClient(
    `https://${storageAccount}.blob.core.windows.net`,
    credential,
  );

  const uploadId = crypto.randomUUID();
  const fileName = basename(videoFile);
  const blobName = `${uploadId}/${fileName}`;
  const videos = blobService.getContainerClient('videos');
  const results = blobService.getContainerClient('results');

  // Seed the `Uploaded` document the API would have written (ADR-0005) — the
  // pipeline ignores blobs with no metadata document. Mirrors
  // services/webapi/src/core/upload-policy.ts#createUploadedDocument (keep in
  // sync); database/container names are the Bicep + app-setting defaults.
  const trackingId = `VXT-${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const metadata = new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credential })
    .database('VideoAnalytics')
    .container('VideoMetadata');
  console.log(`smoke: seeding metadata document ${uploadId} (tracking ${trackingId})`);
  await metadata.items.upsert({
    id: uploadId,
    videoId: null,
    schemaVersion: 1,
    name: fileName,
    blobPath: `videos/${blobName}`,
    playable: true,
    status: 'Uploaded',
    uploadedBy: { userId: 'smoke-test', userDetails: 'deploy-all smoke test' },
    keywords: [],
    topics: [],
    transcript: [],
    chapters: [],
    resultsPrefix: `results/${uploadId}/`,
    trackingIds: { upload: trackingId },
    error: null,
  });

  console.log(`smoke: uploading ${videoFile} → videos/${blobName}`);
  const content = await readFile(videoFile);
  await videos.getBlockBlobClient(blobName).uploadData(content, {
    blobHTTPHeaders: { blobContentType: 'video/mp4' },
  });

  // From here, not startedAt: health retries must not eat the pipeline window.
  const deadline = Date.now() + timeoutMinutes * 60_000;
  const insights = results.getBlobClient(`${uploadId}/insights.json`);
  const captions = results.getBlobClient(`${uploadId}/transcript.vtt`);

  console.log(
    `smoke: polling results/${uploadId}/ every ${String(pollSeconds)}s (timeout ${String(timeoutMinutes)}m)`,
  );
  for (;;) {
    if (await insights.exists()) {
      break;
    }
    if (Date.now() > deadline) {
      // Surface whatever the pipeline managed to capture before giving up.
      const seen: string[] = [];
      for await (const blob of results.listBlobsFlat({ prefix: `${uploadId}/` })) {
        seen.push(blob.name);
      }
      throw new Error(
        `timed out after ${String(timeoutMinutes)}m waiting for insights.json; ` +
          (seen.length > 0
            ? `pipeline wrote only: ${seen.join(', ')} — check the Discord ❌ embed / App Insights`
            : 'no results blobs at all — check Event Grid subscriptions (phase 2 deployed?) and pipeline logs'),
      );
    }
    await sleep(pollSeconds * 1000);
  }

  if (!(await captions.exists())) {
    throw new Error('insights.json exists but transcript.vtt is missing — captions path is broken');
  }

  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
  console.log(`smoke: PASS — uploadId ${uploadId} reached Processed in ${minutes}m`);
  console.log(`smoke: watch it at https://${swaHostname}/videos/watch/?id=${uploadId}`);
  console.log('smoke: a ✅ Discord embed should have arrived in the configured channel');
};

main().catch((error: unknown) => {
  console.error(`smoke: FAIL — ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
