import { type VideoDocument, videoDocumentSchema } from '@vidx/shared';

import { type ApiRequest } from '../../src/app/http.js';
import { type ClientPrincipal } from '../../src/core/principal.js';

/** A valid `Uploaded` document as the webapi creates it at SAS issuance (plan §5). */
export function videoDocument(overrides: Partial<VideoDocument> = {}): VideoDocument {
  return videoDocumentSchema.parse({
    id: 'upl-0001',
    videoId: null,
    schemaVersion: 1,
    name: 'demo.mp4',
    blobPath: 'videos/upl-0001/demo.mp4',
    playable: true,
    status: 'Uploaded',
    uploadedBy: { userId: 'user-1', userDetails: 'user@example.com' },
    resultsPrefix: 'results/upl-0001/',
    trackingIds: { upload: 'VXT-11111111' },
    ...overrides,
  });
}

/** A terminal `Processed` document with insights, as the pipeline leaves it. */
export function processedVideoDocument(overrides: Partial<VideoDocument> = {}): VideoDocument {
  return videoDocument({
    videoId: 'vi-123',
    status: 'Processed',
    durationInSeconds: 62,
    keywords: ['transcription', 'azure'],
    topics: ['Cloud computing'],
    transcript: [
      { text: 'Welcome to the demo.', startSeconds: 1.2, endSeconds: 4.5 },
      { text: 'Uploading a video is easy.', startSeconds: 4.5, endSeconds: 9 },
    ],
    chapters: [{ title: 'Intro', startSeconds: 0, endSeconds: 30 }],
    thumbnailId: 'thumb-1',
    trackingIds: { upload: 'VXT-11111111', results: 'VXT-22222222' },
    submittedAt: '2026-08-12T09:00:00.000Z',
    processedAt: '2026-08-12T09:10:00.000Z',
    ...overrides,
  });
}

export function principal(overrides: Partial<ClientPrincipal> = {}): ClientPrincipal {
  return {
    identityProvider: 'aad',
    userId: 'user-1',
    userDetails: 'user@example.com',
    userRoles: ['anonymous', 'authenticated'],
    ...overrides,
  };
}

export function adminPrincipal(overrides: Partial<ClientPrincipal> = {}): ClientPrincipal {
  return principal({
    userId: 'admin-1',
    userDetails: 'admin@example.com',
    userRoles: ['anonymous', 'authenticated', 'admin'],
    ...overrides,
  });
}

/** Encodes a principal the way SWA does: base64 JSON in `x-ms-client-principal`. */
export function principalHeader(value: ClientPrincipal): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

/**
 * An authenticated request; override `principal: null` for an anonymous one, or
 * `principalHeader` directly for malformed-header cases.
 */
export function apiRequest(
  overrides: Partial<ApiRequest> & { principal?: ClientPrincipal | null } = {},
): ApiRequest {
  const { principal: caller = principal(), ...rest } = overrides;
  return {
    principalHeader: caller === null ? undefined : principalHeader(caller),
    params: {},
    query: {},
    body: undefined,
    ...rest,
  };
}
