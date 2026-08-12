/* eslint-disable no-console -- dev-only process; console IS its logger */
import { Buffer } from 'node:buffer';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { handleDeleteVideo } from '../app/delete-video.js';
import { type WebApiDependencies } from '../app/dependencies.js';
import { handleDownloadTranscript, handleDownloadVideo } from '../app/downloads.js';
import { handleDetailedHealth, handleHealth } from '../app/health.js';
import { type ApiRequest, type ApiResponse } from '../app/http.js';
import { handleOpenApi } from '../app/openapi.js';
import { handleSearch } from '../app/search.js';
import { handleGetStats } from '../app/stats.js';
import { handleGetTranscript } from '../app/transcript.js';
import { handleCreateUpload } from '../app/uploads.js';
import { handleGetVideo, handleListVideos } from '../app/videos.js';
import { captionsBlobName } from '../core/results-layout.js';
import { CANNED_INSIGHTS, seedDocuments, toVtt } from './canned.js';
import {
  devClock,
  devHealthProbes,
  devIds,
  DevResultsStore,
  DevVideoBlobStore,
  DevVideoRepository,
} from './dev-adapters.js';

/*
 * Local dev host (plan §11): the REAL route handlers over in-memory adapters, on a
 * plain node:http server the SWA CLI proxies `/api/*` to. No Functions runtime, no
 * Azure. A tiny simulator stands in for the whole pipeline: a completed browser PUT
 * flips the document to Indexing and, a few seconds later, to Processed with canned
 * insights (file names containing "fail" go to Failed instead, for the failure UX).
 */

const PORT = Number(process.env.WEBAPI_DEV_PORT ?? 7071);
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;
const INDEXING_MS = 10_000;
const SEED_INDEXING_MS = 45_000;

const videos = new DevVideoRepository();
const videoBlobs = new DevVideoBlobStore(BASE_URL);
const results = new DevResultsStore(BASE_URL);

const deps: WebApiDependencies = {
  videos,
  videoBlobs,
  results,
  probes: devHealthProbes,
  logger: {
    info: (message, properties) => {
      console.log(`[webapi] ${message}`, properties ?? '');
    },
    warn: (message, properties) => {
      console.warn(`[webapi] ${message}`, properties ?? '');
    },
    error: (message, properties) => {
      console.error(`[webapi] ${message}`, properties ?? '');
    },
  },
  clock: devClock,
  ids: devIds,
  options: { videosContainer: 'videos', resultsContainer: 'results', healthProbeTimeoutMs: 2000 },
};

/** Move an Uploaded document through Indexing to Processed/Failed with canned data. */
function simulateIndexing(uploadId: string, delayMs: number): void {
  void videos.get(uploadId).then((document) => {
    if (document === null || document.status === 'Processed' || document.status === 'Failed') {
      return;
    }
    videos.upsert({
      ...document,
      status: 'Indexing',
      videoId: `vi-${uploadId}`,
      submittedAt: document.submittedAt ?? devClock.now().toISOString(),
    });
    setTimeout(() => {
      void videos.get(uploadId).then((current) => {
        if (current?.status !== 'Indexing') {
          return;
        }
        if (current.name.toLowerCase().includes('fail')) {
          videos.upsert({
            ...current,
            status: 'Failed',
            error: 'Video Indexer could not decode the stream (simulated failure).',
          });
          console.log(`[dev] simulated failure for ${current.name}`);
          return;
        }
        videos.upsert({
          ...current,
          status: 'Processed',
          processedAt: devClock.now().toISOString(),
          durationInSeconds: CANNED_INSIGHTS.durationInSeconds,
          keywords: CANNED_INSIGHTS.keywords,
          topics: CANNED_INSIGHTS.topics,
          transcript: CANNED_INSIGHTS.transcript,
          chapters: CANNED_INSIGHTS.chapters,
        });
        results.blobs.set(captionsBlobName(current.id), toVtt(CANNED_INSIGHTS.transcript));
        console.log(`[dev] simulated indexing complete for ${current.name}`);
      });
    }, delayMs);
  });
}

type Handler = (request: ApiRequest, deps: WebApiDependencies) => Promise<ApiResponse>;

const ROUTES: { method: string; pattern: RegExp; handler: Handler }[] = [
  { method: 'POST', pattern: /^\/api\/uploads$/, handler: handleCreateUpload },
  { method: 'GET', pattern: /^\/api\/videos$/, handler: handleListVideos },
  { method: 'GET', pattern: /^\/api\/videos\/(?<id>[^/]+)$/, handler: handleGetVideo },
  { method: 'DELETE', pattern: /^\/api\/videos\/(?<id>[^/]+)$/, handler: handleDeleteVideo },
  {
    method: 'GET',
    pattern: /^\/api\/videos\/(?<id>[^/]+)\/transcript$/,
    handler: handleGetTranscript,
  },
  {
    method: 'GET',
    pattern: /^\/api\/videos\/(?<id>[^/]+)\/download$/,
    handler: handleDownloadVideo,
  },
  {
    method: 'GET',
    pattern: /^\/api\/videos\/(?<id>[^/]+)\/download\/transcript$/,
    handler: handleDownloadTranscript,
  },
  { method: 'GET', pattern: /^\/api\/search$/, handler: handleSearch },
  { method: 'GET', pattern: /^\/api\/stats$/, handler: handleGetStats },
  { method: 'GET', pattern: /^\/api\/health$/, handler: handleHealth },
  { method: 'GET', pattern: /^\/api\/health\/detailed$/, handler: handleDetailedHealth },
  { method: 'GET', pattern: /^\/api\/openapi\.json$/, handler: handleOpenApi },
];

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    request.on('error', reject);
  });
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'content-type, x-ms-blob-type',
} as const;

/** The stand-in blob endpoint: browser PUT for uploads, range-aware GET for playback. */
async function handleDevBlob(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, CORS_HEADERS);
    response.end();
    return;
  }

  const videoMatch = /^\/devblob\/videos\/(?<name>.+)$/.exec(pathname);
  const resultsMatch = /^\/devblob\/results\/(?<name>.+)$/.exec(pathname);

  if (videoMatch?.groups?.name !== undefined && request.method === 'PUT') {
    const blobName = decodeURI(videoMatch.groups.name);
    const bytes = await readBody(request);
    videoBlobs.blobs.set(blobName, {
      bytes,
      contentType: request.headers['content-type'] ?? 'application/octet-stream',
    });
    console.log(`[dev] received ${String(bytes.length)} bytes for ${blobName}`);
    // First path segment of `{uploadId}/{fileName}` is the document id.
    simulateIndexing(blobName.split('/')[0] ?? '', INDEXING_MS);
    response.writeHead(201, CORS_HEADERS);
    response.end();
    return;
  }

  if (videoMatch?.groups?.name !== undefined && request.method === 'GET') {
    const blobName = decodeURI(videoMatch.groups.name);
    const stored = videoBlobs.blobs.get(blobName);
    if (stored === undefined) {
      response.writeHead(404, CORS_HEADERS);
      response.end();
      return;
    }
    const url = new URL(request.url ?? '/', BASE_URL);
    const disposition = url.searchParams.get('rscd');
    const range = /^bytes=(?<start>\d+)-(?<end>\d*)$/.exec(request.headers.range ?? '');
    const total = stored.bytes.length;
    const start = range?.groups?.start === undefined ? 0 : Number(range.groups.start);
    const end =
      range?.groups?.end === undefined || range.groups.end === ''
        ? total - 1
        : Math.min(Number(range.groups.end), total - 1);
    const headers = {
      ...CORS_HEADERS,
      'content-type': stored.contentType,
      'accept-ranges': 'bytes',
      'content-length': String(end - start + 1),
      ...(disposition === null ? {} : { 'content-disposition': disposition }),
      ...(range === null
        ? {}
        : { 'content-range': `bytes ${String(start)}-${String(end)}/${String(total)}` }),
    };
    response.writeHead(range === null ? 200 : 206, headers);
    response.end(stored.bytes.subarray(start, end + 1));
    return;
  }

  if (resultsMatch?.groups?.name !== undefined && request.method === 'GET') {
    const content = results.blobs.get(decodeURI(resultsMatch.groups.name));
    if (content === undefined) {
      response.writeHead(404, CORS_HEADERS);
      response.end();
      return;
    }
    response.writeHead(200, { ...CORS_HEADERS, 'content-type': 'text/vtt' });
    response.end(content);
    return;
  }

  response.writeHead(405, CORS_HEADERS);
  response.end();
}

async function handleApi(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  const url = new URL(request.url ?? '/', BASE_URL);
  for (const route of ROUTES) {
    if (route.method !== request.method) {
      continue;
    }
    const match = route.pattern.exec(pathname);
    if (match === null) {
      continue;
    }
    const raw = await readBody(request);
    let body: unknown;
    if (raw.length > 0) {
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        body = undefined;
      }
    }
    const params = Object.fromEntries(
      Object.entries(match.groups ?? {}).map(([key, value]) => [key, decodeURIComponent(value)]),
    );
    const principalHeader = request.headers['x-ms-client-principal'];
    const apiRequest: ApiRequest = {
      principalHeader: Array.isArray(principalHeader) ? principalHeader[0] : principalHeader,
      params,
      query: Object.fromEntries(url.searchParams),
      body,
    };
    const result = await route.handler(apiRequest, deps);
    const headers: Record<string, string> = { ...result.headers };
    let payload: string | undefined;
    if (result.jsonBody !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(result.jsonBody);
    } else if (result.body !== undefined) {
      payload = result.body;
    }
    response.writeHead(result.status, headers);
    response.end(payload);
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: { code: 'not_found', message: 'No such route.' } }));
}

for (const document of seedDocuments(devClock.now())) {
  videos.upsert(document);
  if (document.status === 'Processed') {
    results.blobs.set(captionsBlobName(document.id), toVtt(document.transcript));
  }
}
// One seeded row completes shortly after boot so the completion toast demos itself.
simulateIndexing('seed-indexing', SEED_INDEXING_MS);

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', BASE_URL).pathname;
  const route = pathname.startsWith('/devblob/')
    ? handleDevBlob(request, response, pathname)
    : handleApi(request, response, pathname);
  route.catch((error: unknown) => {
    console.error('[dev] request failed', error);
    if (!response.headersSent) {
      response.writeHead(500);
    }
    response.end();
  });
});

server.listen(PORT, () => {
  console.log(`[dev] webapi dev host on ${BASE_URL} (seeded library, simulated pipeline)`);
});
