// `pnpm diagnostics --id <uploadId>` (plan §7): downloads a video's full diagnostics
// bundle (results/{id}/diagnostics/* plus insights.json + transcript.vtt when present)
// and the Cosmos metadata doc to ./.diagnostics/<id>/, ready for
// `pnpm replay --bundle ./.diagnostics/<id>` — same fixture format as tests.
//
// Auth is the caller's own `az login` (AzureCliCredential): support needs RBAC read
// only. The Cosmos doc fetch is best-effort — without a Cosmos data-plane role it
// prints the grant command from the support runbook instead of failing the download.
// Runs directly under Node 24 (type stripping).

import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AzureCliCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { CosmosClient } from '@azure/cosmos';

const usage = 'Usage: pnpm diagnostics --id <uploadId> [--group <resource-group>]';

const readArg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const uploadId = readArg('--id');
if (!uploadId) {
  console.error(usage);
  process.exit(2);
}
const resourceGroup = readArg('--group') ?? process.env['AZURE_RESOURCE_GROUP'] ?? 'rg-vidx-prod';

const az = (args: string[]): string => {
  const result = spawnSync('az', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`diagnostics: \`az ${args.join(' ')}\` failed:\n${result.stderr}`);
    process.exit(1);
  }
  return result.stdout.trim();
};

const main = async (): Promise<void> => {
  console.log(`diagnostics: resolving accounts in resource group ${resourceGroup}`);
  const storageAccount = az([
    'storage',
    'account',
    'list',
    '--resource-group',
    resourceGroup,
    '--query',
    '[0].name',
    '--output',
    'tsv',
  ]);
  const cosmosEndpoint = az([
    'cosmosdb',
    'list',
    '--resource-group',
    resourceGroup,
    '--query',
    '[0].documentEndpoint',
    '--output',
    'tsv',
  ]);

  const credential = new AzureCliCredential();
  const blobService = new BlobServiceClient(
    `https://${storageAccount}.blob.core.windows.net`,
    credential,
  );
  const results = blobService.getContainerClient('results');

  const targetDir = join('.diagnostics', uploadId);
  await mkdir(targetDir, { recursive: true });

  let count = 0;
  for await (const blob of results.listBlobsFlat({ prefix: `${uploadId}/` })) {
    // results/{id}/diagnostics/foo.json → .diagnostics/{id}/foo.json (bundle root);
    // sibling outputs (insights.json, transcript.vtt) keep their names alongside.
    const relative = blob.name.slice(`${uploadId}/`.length).replace(/^diagnostics\//, '');
    const destination = join(targetDir, relative);
    await mkdir(join(destination, '..'), { recursive: true });
    const download = await results.getBlobClient(blob.name).downloadToBuffer();
    await writeFile(destination, download);
    console.log(`diagnostics: ${blob.name} → ${destination}`);
    count += 1;
  }
  if (count === 0) {
    console.error(
      `diagnostics: no blobs under results/${uploadId}/ — wrong id or nothing captured`,
    );
    process.exit(1);
  }

  try {
    const cosmos = new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credential });
    const { resource } = await cosmos
      .database('VideoAnalytics')
      .container('VideoMetadata')
      .item(uploadId, uploadId)
      .read<Record<string, unknown>>();
    await writeFile(join(targetDir, 'document.json'), `${JSON.stringify(resource, null, 2)}\n`);
    console.log(`diagnostics: Cosmos doc → ${join(targetDir, 'document.json')}`);
  } catch (error: unknown) {
    console.warn(
      `diagnostics: could not read the Cosmos doc (${error instanceof Error ? error.message : String(error)}).\n` +
        '  You likely need the Cosmos data-plane reader role — see docs/support-runbook.md.\n' +
        '  The blob bundle above is complete and replayable without it.',
    );
  }

  console.log(`diagnostics: done — replay with: pnpm replay --bundle ${targetDir}`);
};

main().catch((error: unknown) => {
  console.error(`diagnostics: FAIL — ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
