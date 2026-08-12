import { errorEnvelopeSchema } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { handleDeleteVideo } from '../../src/app/delete-video.js';
import { type WebApiDependencies } from '../../src/app/dependencies.js';
import { handleDownloadTranscript, handleDownloadVideo } from '../../src/app/downloads.js';
import { handleDetailedHealth, handleHealth } from '../../src/app/health.js';
import { type ApiRequest, type ApiResponse } from '../../src/app/http.js';
import { handleOpenApi } from '../../src/app/openapi.js';
import { handleSearch } from '../../src/app/search.js';
import { handleGetStats } from '../../src/app/stats.js';
import { handleGetTranscript } from '../../src/app/transcript.js';
import { handleCreateUpload } from '../../src/app/uploads.js';
import { handleGetVideo, handleListVideos } from '../../src/app/videos.js';
import { apiRequest, principalHeader } from '../support/builders.js';
import { testDependencies } from '../support/deps.js';

type Handler = (request: ApiRequest, deps: WebApiDependencies) => Promise<ApiResponse>;

/**
 * The M3 acceptance matrix (plan §13): health is the only anonymous route; every
 * other endpoint rejects anonymous callers with a 401 envelope; authenticated
 * requests log the principal. (The delete owner/admin/other matrix lives in
 * delete-video.test.ts.)
 */
const AUTHENTICATED_ENDPOINTS: [string, Handler][] = [
  ['createUpload', handleCreateUpload],
  ['listVideos', handleListVideos],
  ['getVideo', handleGetVideo],
  ['getTranscript', handleGetTranscript],
  ['search', handleSearch],
  ['downloadVideo', handleDownloadVideo],
  ['downloadTranscript', handleDownloadTranscript],
  ['deleteVideo', handleDeleteVideo],
  ['getStats', handleGetStats],
  ['getDetailedHealth', handleDetailedHealth],
  ['getOpenApi', handleOpenApi],
];

describe('authorization matrix', () => {
  describe.each(AUTHENTICATED_ENDPOINTS)('%s', (operation, handler) => {
    it('rejects a request with no principal header', async () => {
      const deps = testDependencies();

      const result = await handler(apiRequest({ principal: null, params: { id: 'x' } }), deps);

      expect(result.status).toBe(401);
      const { error } = errorEnvelopeSchema.parse(result.jsonBody);
      expect(error.code).toBe('unauthorized');
      expect(deps.logger.messages('warn')).toContain('Rejected anonymous request');
    });

    it('rejects a garbage principal header', async () => {
      const result = await handler(
        apiRequest({ principalHeader: 'not-a-principal', params: { id: 'x' } }),
        testDependencies(),
      );

      expect(result.status).toBe(401);
    });

    it('rejects a principal without the authenticated role', async () => {
      const header = principalHeader({
        identityProvider: 'aad',
        userId: 'user-1',
        userDetails: 'user@example.com',
        userRoles: ['anonymous'],
      });

      const result = await handler(
        apiRequest({ principalHeader: header, params: { id: 'x' } }),
        testDependencies(),
      );

      expect(result.status).toBe(401);
    });

    it('logs the principal on an authenticated request (audit, plan §6)', async () => {
      const deps = testDependencies();

      await handler(apiRequest({ params: { id: 'x' } }), deps);

      const audit = deps.logger.entries.find((entry) => entry.message === 'API request');
      expect(audit?.properties).toMatchObject({
        operation,
        userId: 'user-1',
        userDetails: 'user@example.com',
      });
    });
  });

  it('health is anonymous — the single carve-out', async () => {
    const result = await handleHealth(apiRequest({ principal: null }), testDependencies());

    expect(result.status).toBe(200);
  });
});
