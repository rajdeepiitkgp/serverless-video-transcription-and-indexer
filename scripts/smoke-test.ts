// Post-deploy smoke test (plan §3/§9): checks /api/health through the SWA domain,
// uploads a sample clip straight into the videos container, and polls the results
// container until the pipeline writes insights.json + transcript.vtt (i.e. the video
// reached Processed end-to-end: BlobCreated → VI → callback → results → Cosmos).
// The uploaded clip is deliberately left in place — it becomes the library's first
// entry and M7's playable-with-CC check reuses it.
//
// Auth: DefaultAzureCredential (az login locally, OIDC via azure/login in CI). The
// deploy identity holds Storage Blob Data Contributor (bootstrap-azure.sh) so it can
// upload without any key or SAS. Runs directly under Node 24 (type stripping).
//
// Env: SMOKE_STORAGE_ACCOUNT (required), SMOKE_SWA_HOSTNAME (required),
//      SMOKE_VIDEO_FILE (required, path to a small clip),
//      SMOKE_TIMEOUT_MINUTES (default 20), SMOKE_POLL_SECONDS (default 15).

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
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
const videoFile = requireEnv('SMOKE_VIDEO_FILE');
const timeoutMinutes = Number(process.env['SMOKE_TIMEOUT_MINUTES'] ?? '20');
const pollSeconds = Number(process.env['SMOKE_POLL_SECONDS'] ?? '15');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const checkHealth = async (): Promise<void> => {
  const url = `https://${swaHostname}/api/health`;
  const response = await fetch(url);
  const body = (await response.json()) as { data?: { status?: string } };
  const status = body.data?.status;
  console.log(`smoke: GET ${url} → ${String(response.status)} (status: ${status ?? 'unknown'})`);
  if (!response.ok) {
    throw new Error(
      `health endpoint returned ${String(response.status)} — SWA or linked backend is down`,
    );
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
  const blobName = `${uploadId}/${basename(videoFile)}`;
  const videos = blobService.getContainerClient('videos');
  const results = blobService.getContainerClient('results');

  console.log(`smoke: uploading ${videoFile} → videos/${blobName}`);
  const content = await readFile(videoFile);
  await videos.getBlockBlobClient(blobName).uploadData(content, {
    blobHTTPHeaders: { blobContentType: 'video/mp4' },
  });

  const deadline = startedAt + timeoutMinutes * 60_000;
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
