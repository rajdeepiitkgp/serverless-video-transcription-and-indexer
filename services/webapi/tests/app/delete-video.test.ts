import { deleteResponseSchema, envelope, errorEnvelopeSchema } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { handleDeleteVideo } from '../../src/app/delete-video.js';
import { adminPrincipal, apiRequest, principal, videoDocument } from '../support/builders.js';
import { testDependencies } from '../support/deps.js';

function seededDeps(): ReturnType<typeof testDependencies> {
  const deps = testDependencies();
  deps.videos.seed(
    videoDocument({ uploadedBy: { userId: 'owner-1', userDetails: 'owner@example.com' } }),
  );
  deps.results.blobs.set('upl-0001/transcript.vtt', 'WEBVTT');
  deps.results.blobs.set('upl-0001/diagnostics/entry.json', '{}');
  return deps;
}

describe('handleDeleteVideo — authz matrix (plan §4: owner or admin)', () => {
  it('lets the owner delete their own upload', async () => {
    const deps = seededDeps();

    const result = await handleDeleteVideo(
      apiRequest({ principal: principal({ userId: 'owner-1' }), params: { id: 'upl-0001' } }),
      deps,
    );

    expect(result.status).toBe(200);
    expect(envelope(deleteResponseSchema).parse(result.jsonBody).data).toEqual({ id: 'upl-0001' });
  });

  it("lets an admin delete someone else's upload", async () => {
    const deps = seededDeps();

    const result = await handleDeleteVideo(
      apiRequest({ principal: adminPrincipal(), params: { id: 'upl-0001' } }),
      deps,
    );

    expect(result.status).toBe(200);
  });

  it('answers 403 for a different non-admin user and deletes nothing', async () => {
    const deps = seededDeps();

    const result = await handleDeleteVideo(
      apiRequest({ principal: principal({ userId: 'other-2' }), params: { id: 'upl-0001' } }),
      deps,
    );

    expect(result.status).toBe(403);
    expect(errorEnvelopeSchema.parse(result.jsonBody).error.code).toBe('forbidden');
    expect(deps.videos.documents.has('upl-0001')).toBe(true);
    expect(deps.videoBlobs.deleted).toHaveLength(0);
    expect(deps.results.deletedPrefixes).toHaveLength(0);
    expect(deps.logger.messages('warn')).toContain('Delete denied');
  });
});

describe('handleDeleteVideo — behavior', () => {
  it('removes the source blob, the whole results prefix, and the document', async () => {
    const deps = seededDeps();

    await handleDeleteVideo(
      apiRequest({ principal: principal({ userId: 'owner-1' }), params: { id: 'upl-0001' } }),
      deps,
    );

    expect(deps.videoBlobs.deleted).toEqual(['upl-0001/demo.mp4']);
    expect(deps.results.deletedPrefixes).toEqual(['upl-0001/']);
    expect(deps.results.blobs.size).toBe(0);
    expect(deps.videos.documents.size).toBe(0);
  });

  it('answers 404 for an unknown id', async () => {
    const result = await handleDeleteVideo(
      apiRequest({ params: { id: 'nope' } }),
      testDependencies(),
    );

    expect(result.status).toBe(404);
  });

  it('keeps the document when blob deletion fails, so the delete stays retryable', async () => {
    const deps = seededDeps();
    deps.videoBlobs.deleteError = new Error('storage down');

    const result = await handleDeleteVideo(
      apiRequest({ principal: principal({ userId: 'owner-1' }), params: { id: 'upl-0001' } }),
      deps,
    );

    expect(result.status).toBe(500);
    expect(deps.videos.documents.has('upl-0001')).toBe(true);
  });

  it('logs who deleted whose video (audit)', async () => {
    const deps = seededDeps();

    await handleDeleteVideo(
      apiRequest({ principal: adminPrincipal(), params: { id: 'upl-0001' } }),
      deps,
    );

    const audit = deps.logger.entries.find((entry) => entry.message === 'Video deleted');
    expect(audit?.properties).toMatchObject({ userId: 'admin-1', ownerId: 'owner-1' });
  });
});
