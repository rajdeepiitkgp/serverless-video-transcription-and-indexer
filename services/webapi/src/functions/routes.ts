import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';

import { webApiDependencies } from '../app/composition-root.js';
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
import { contextLogger } from './context-logger.js';

/**
 * Route registrations (plan §4's endpoint table). All `authLevel: 'anonymous'`:
 * platform Easy Auth locks the app to SWA-only traffic (plan §2), SWA forwards the
 * caller as `x-ms-client-principal`, and the app layer enforces sign-in per route —
 * `GET /api/health` being the single anonymous carve-out. The default `/api` route
 * prefix must stay (linked-backend constraint, plan §2).
 */
type Handler = (request: ApiRequest, deps: WebApiDependencies) => Promise<ApiResponse>;

async function toApiRequest(request: HttpRequest): Promise<ApiRequest> {
  let body: unknown;
  if (request.body !== null) {
    body = await request.json().catch(() => undefined);
  }
  return {
    principalHeader: request.headers.get('x-ms-client-principal') ?? undefined,
    params: request.params,
    query: Object.fromEntries(request.query),
    body,
  };
}

function toResponseInit(response: ApiResponse): HttpResponseInit {
  return {
    status: response.status,
    ...(response.jsonBody === undefined ? {} : { jsonBody: response.jsonBody }),
    ...(response.body === undefined ? {} : { body: response.body }),
    ...(response.headers === undefined ? {} : { headers: response.headers }),
  };
}

function adapt(handler: Handler) {
  return async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const deps = webApiDependencies(contextLogger(context));
    return toResponseInit(await handler(await toApiRequest(request), deps));
  };
}

app.http('CreateUpload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'uploads',
  handler: adapt(handleCreateUpload),
});

app.http('ListVideos', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos',
  handler: adapt(handleListVideos),
});

app.http('GetVideo', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{id}',
  handler: adapt(handleGetVideo),
});

app.http('DeleteVideo', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'videos/{id}',
  handler: adapt(handleDeleteVideo),
});

app.http('GetTranscript', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{id}/transcript',
  handler: adapt(handleGetTranscript),
});

app.http('DownloadVideo', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{id}/download',
  handler: adapt(handleDownloadVideo),
});

app.http('DownloadTranscript', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{id}/download/transcript',
  handler: adapt(handleDownloadTranscript),
});

app.http('Search', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'search',
  handler: adapt(handleSearch),
});

app.http('GetStats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'stats',
  handler: adapt(handleGetStats),
});

app.http('GetHealth', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: adapt(handleHealth),
});

app.http('GetDetailedHealth', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health/detailed',
  handler: adapt(handleDetailedHealth),
});

app.http('GetOpenApi', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'openapi.json',
  handler: adapt(handleOpenApi),
});
