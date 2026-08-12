import * as z from 'zod';
import { createDocument } from 'zod-openapi';

import { envelope, errorEnvelopeSchema } from '../contracts/envelope.js';
import { detailedHealthResponseSchema, healthResponseSchema } from '../contracts/health.js';
import { searchQuerySchema, searchResponseSchema } from '../contracts/search.js';
import { statsResponseSchema } from '../contracts/stats.js';
import { uploadRequestSchema, uploadResponseSchema } from '../contracts/uploads.js';
import { transcriptLineSchema, videoDocumentSchema } from '../contracts/video.js';
import {
  deleteResponseSchema,
  downloadResponseSchema,
  transcriptDownloadQuerySchema,
  transcriptResponseSchema,
  videoDetailSchema,
  videoSummarySchema,
} from '../contracts/videos.js';

export type OpenApiDocument = ReturnType<typeof createDocument>;

const idPathParams = z.object({
  id: z.string().min(1).meta({ description: 'The video uploadId' }),
});

const errorResponse = {
  description: 'Error. Every error carries a user-quotable trackingId (VXT-xxxxxxxx).',
  content: { 'application/json': { schema: errorEnvelopeSchema } },
};

function jsonResponse(
  description: string,
  schema: z.ZodType,
): {
  description: string;
  content: { 'application/json': { schema: z.ZodType } };
} {
  return { description, content: { 'application/json': { schema: envelope(schema) } } };
}

/**
 * The OpenAPI 3.1 description of the webapi surface (plan §4), generated from the
 * shared zod contracts and served at GET /api/openapi.json for the Scalar `/docs`
 * page. Auth is platform-level (SWA built-in Microsoft login proxies `/api/*` and
 * injects `x-ms-client-principal`), so no OpenAPI securityScheme applies; every
 * route except GET /api/health requires a signed-in user.
 */
export function createOpenApiDocument(): OpenApiDocument {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Serverless Video Transcription & Indexer API',
      version: '1.0.0',
      description:
        'HTTP API of the video transcription pipeline. Reachable only through the ' +
        'Static Web App (`/api/*`); direct function-app calls are rejected. All ' +
        'routes except `GET /api/health` require a signed-in Microsoft account. ' +
        'Success bodies are wrapped in `{ data: … }`; errors in `{ error: … }` with ' +
        'a support trackingId.',
    },
    servers: [{ url: '/' }],
    components: { schemas: { VideoDocument: videoDocumentSchema } },
    paths: {
      '/api/uploads': {
        post: {
          operationId: 'createUpload',
          tags: ['uploads'],
          summary: 'Request an upload slot',
          description:
            'Validates type/size, creates the Uploaded metadata document, and returns ' +
            'a short-lived write-only SAS for the browser to PUT the blob directly. ' +
            '`playable: false` warns that the format is indexable but not previewable.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: uploadRequestSchema } },
          },
          responses: {
            '201': jsonResponse('Upload slot created', uploadResponseSchema),
            default: errorResponse,
          },
        },
      },
      '/api/videos': {
        get: {
          operationId: 'listVideos',
          tags: ['videos'],
          summary: 'List videos',
          responses: {
            '200': jsonResponse('All videos', z.object({ videos: z.array(videoSummarySchema) })),
            default: errorResponse,
          },
        },
      },
      '/api/videos/{id}': {
        get: {
          operationId: 'getVideo',
          tags: ['videos'],
          summary: 'Video detail',
          description: 'Full metadata + insight summary + short-lived playback SAS + captions URL.',
          requestParams: { path: idPathParams },
          responses: {
            '200': jsonResponse('The video', videoDetailSchema),
            default: errorResponse,
          },
        },
        delete: {
          operationId: 'deleteVideo',
          tags: ['videos'],
          summary: 'Delete a video (owner or admin)',
          description:
            'Deletes blob + results + metadata document. Owners delete their own ' +
            'uploads; admins delete any.',
          requestParams: { path: idPathParams },
          responses: {
            '200': jsonResponse('Deleted', deleteResponseSchema),
            default: errorResponse,
          },
        },
      },
      '/api/videos/{id}/transcript': {
        get: {
          operationId: 'getTranscript',
          tags: ['videos'],
          summary: 'Timestamped transcript',
          requestParams: { path: idPathParams },
          responses: {
            '200': jsonResponse('Transcript lines', transcriptResponseSchema),
            default: errorResponse,
          },
        },
      },
      '/api/videos/{id}/download': {
        get: {
          operationId: 'downloadVideo',
          tags: ['downloads'],
          summary: 'Source video download link',
          description: 'Read SAS with content-disposition: attachment for the source video.',
          requestParams: { path: idPathParams },
          responses: {
            '200': jsonResponse('Download link', downloadResponseSchema),
            default: errorResponse,
          },
        },
      },
      '/api/videos/{id}/download/transcript': {
        get: {
          operationId: 'downloadTranscript',
          tags: ['downloads'],
          summary: 'Subtitles / transcript file download',
          requestParams: { path: idPathParams, query: transcriptDownloadQuerySchema },
          responses: {
            '200': {
              description: 'The transcript file in the requested format',
              content: {
                'text/vtt': { schema: z.string() },
                'application/json': { schema: z.array(transcriptLineSchema) },
              },
            },
            default: errorResponse,
          },
        },
      },
      '/api/search': {
        get: {
          operationId: 'search',
          tags: ['search'],
          summary: 'Search the library',
          description:
            'Matches across name/keywords/topics/transcript lines; transcript hits ' +
            'carry timestamps for search-to-seek.',
          requestParams: { query: searchQuerySchema },
          responses: {
            '200': jsonResponse('Search results', searchResponseSchema),
            default: errorResponse,
          },
        },
      },
      '/api/stats': {
        get: {
          operationId: 'getStats',
          tags: ['stats'],
          summary: 'Dashboard aggregates',
          responses: {
            '200': jsonResponse('Aggregates', statsResponseSchema),
            default: errorResponse,
          },
        },
      },
      '/api/health': {
        get: {
          operationId: 'getHealth',
          tags: ['health'],
          summary: 'Liveness probe',
          description:
            'The only anonymous route (used by the availability test). Terse by ' +
            'design: status only, nothing leakable.',
          responses: {
            '200': jsonResponse('Liveness', healthResponseSchema),
            default: errorResponse,
          },
        },
      },
      '/api/health/detailed': {
        get: {
          operationId: 'getDetailedHealth',
          tags: ['health'],
          summary: 'Per-dependency health',
          responses: {
            '200': jsonResponse('Dependency checks', detailedHealthResponseSchema),
            default: errorResponse,
          },
        },
      },
      '/api/openapi.json': {
        get: {
          operationId: 'getOpenApi',
          tags: ['docs'],
          summary: 'This document',
          description: 'OpenAPI 3.1, generated from the shared zod schemas.',
          responses: {
            '200': {
              description: 'The OpenAPI document (served unenveloped)',
              content: {
                'application/json': { schema: z.record(z.string(), z.unknown()) },
              },
            },
            default: errorResponse,
          },
        },
      },
    },
  });
}
