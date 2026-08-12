import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Boots a throwaway Azurite blob service for the adapter integration tests
 * (docs/testing-principles.md §3). Port 0 lets the OS pick a free port — the
 * assigned one is parsed from Azurite's startup line and handed to tests via
 * AZURITE_BLOB_CONNECTION_STRING. Tests skip Azurite-backed suites if unset.
 */
const STARTUP_TIMEOUT_MS = 30_000;

// Azurite's fixed, publicly documented dev-storage account (not a secret).
const ACCOUNT_NAME = 'devstoreaccount1';
const ACCOUNT_KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

let azurite: ChildProcess | undefined;
let dataDir: string | undefined;

// eslint-disable-next-line no-restricted-syntax -- Vitest global setup requires a default export
export default async function setup(): Promise<() => Promise<void>> {
  dataDir = await mkdtemp(join(tmpdir(), 'vidx-azurite-'));

  const require = createRequire(import.meta.url);
  const azuriteBin = join(
    dirname(require.resolve('azurite/package.json')),
    'dist/src/blob/main.js',
  );

  const child = spawn(
    process.execPath,
    [
      azuriteBin,
      '--blobPort',
      '0',
      '--location',
      dataDir,
      '--blobHost',
      '127.0.0.1',
      // The storage SDK's service version usually runs ahead of Azurite's support matrix.
      '--skipApiVersionCheck',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  azurite = child;

  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Azurite did not start within 30s'));
    }, STARTUP_TIMEOUT_MS);
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const match = /Azurite Blob service successfully listens on http:\/\/[\d.]+:(\d+)/.exec(
        output,
      );
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Azurite exited early (code ${String(code)}): ${output}`));
    });
  });

  process.env.AZURITE_BLOB_CONNECTION_STRING =
    `DefaultEndpointsProtocol=http;AccountName=${ACCOUNT_NAME};AccountKey=${ACCOUNT_KEY};` +
    `BlobEndpoint=http://127.0.0.1:${String(port)}/${ACCOUNT_NAME};`;

  return async () => {
    if (azurite?.exitCode === null) {
      const exited = new Promise<void>((resolve) =>
        child.once('exit', () => {
          resolve();
        }),
      );
      azurite.kill();
      await exited;
    }
    if (dataDir !== undefined) {
      await rm(dataDir, { recursive: true, force: true });
    }
  };
}
