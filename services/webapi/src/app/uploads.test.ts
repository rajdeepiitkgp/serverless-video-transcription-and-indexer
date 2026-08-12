import { envelope, errorEnvelopeSchema, uploadResponseSchema } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { apiRequest, principal } from '../../test-support/builders.js';
import { testDependencies } from '../../test-support/deps.js';
import { handleCreateUpload } from './uploads.js';

const validBody = { fileName: 'demo.mp4', contentType: 'video/mp4', sizeBytes: 1024 };

describe('handleCreateUpload', () => {
  it('creates the Uploaded document and answers 201 with a write SAS (contract)', async () => {
    const deps = testDependencies();

    const result = await handleCreateUpload(apiRequest({ body: validBody }), deps);

    expect(result.status).toBe(201);
    const { data } = envelope(uploadResponseSchema).parse(result.jsonBody);
    expect(data).toEqual({
      uploadId: 'upl-0001',
      uploadUrl: 'https://fake.blob.core.windows.net/videos/upl-0001/demo.mp4?sig=fake-write-sas',
      blobPath: 'videos/upl-0001/demo.mp4',
      playable: true,
      expiresAt: '2026-08-12T10:15:00.000Z',
    });

    const document = deps.videos.documents.get('upl-0001');
    expect(document).toMatchObject({
      status: 'Uploaded',
      name: 'demo.mp4',
      playable: true,
      uploadedBy: { userId: 'user-1', userDetails: 'user@example.com' },
      resultsPrefix: 'results/upl-0001/',
    });
  });

  it('issues a 15-minute write-only SAS backdated for clock skew', async () => {
    const deps = testDependencies();

    await handleCreateUpload(apiRequest({ body: validBody }), deps);

    expect(deps.videoBlobs.uploadSasRequests).toEqual([
      {
        blobName: 'upl-0001/demo.mp4',
        policy: {
          permissions: 'cw',
          startsOn: new Date('2026-08-12T09:55:00.000Z'),
          expiresOn: new Date('2026-08-12T10:15:00.000Z'),
        },
      },
    ]);
  });

  it('flags an indexable but non-playable format without rejecting it', async () => {
    const deps = testDependencies();

    const result = await handleCreateUpload(
      apiRequest({ body: { ...validBody, fileName: 'raw.mkv' } }),
      deps,
    );

    const { data } = envelope(uploadResponseSchema).parse(result.jsonBody);
    expect(data.playable).toBe(false);
    expect(deps.videos.documents.get('upl-0001')?.playable).toBe(false);
  });

  it('answers 400 with an error envelope for a malformed body', async () => {
    const deps = testDependencies();

    const result = await handleCreateUpload(apiRequest({ body: { fileName: 'demo.mp4' } }), deps);

    expect(result.status).toBe(400);
    const { error } = errorEnvelopeSchema.parse(result.jsonBody);
    expect(error.code).toBe('validation_failed');
    expect(deps.videos.documents.size).toBe(0);
  });

  it('answers 400 for an unsupported format and creates nothing', async () => {
    const deps = testDependencies();

    const result = await handleCreateUpload(
      apiRequest({ body: { ...validBody, fileName: 'notes.txt' } }),
      deps,
    );

    expect(result.status).toBe(400);
    const { error } = errorEnvelopeSchema.parse(result.jsonBody);
    expect(error.message).toContain('.txt');
    expect(deps.videos.documents.size).toBe(0);
    expect(deps.videoBlobs.uploadSasRequests).toHaveLength(0);
  });

  it('answers 500 with a tracked envelope when the repository write fails', async () => {
    const deps = testDependencies();
    deps.videos.createError = new Error('cosmos unavailable');

    const result = await handleCreateUpload(apiRequest({ body: validBody }), deps);

    expect(result.status).toBe(500);
    const { error } = errorEnvelopeSchema.parse(result.jsonBody);
    expect(error.code).toBe('internal_error');
    expect(error.message).toContain(error.trackingId);
    expect(
      deps.logger.entries.some(
        (entry) => entry.level === 'error' && entry.properties?.trackingId === error.trackingId,
      ),
    ).toBe(true);
  });

  it('stamps the caller identity from the principal, not the body', async () => {
    const deps = testDependencies();

    await handleCreateUpload(
      apiRequest({
        principal: principal({ userId: 'user-9', userDetails: 'niner@example.com' }),
        body: { ...validBody, uploadedBy: { userId: 'spoof', userDetails: 'spoof' } },
      }),
      deps,
    );

    expect(deps.videos.documents.get('upl-0001')?.uploadedBy).toEqual({
      userId: 'user-9',
      userDetails: 'niner@example.com',
    });
  });
});
