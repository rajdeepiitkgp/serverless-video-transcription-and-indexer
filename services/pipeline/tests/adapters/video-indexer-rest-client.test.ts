import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createVideoIndexerRestClient } from '../../src/adapters/video-indexer-rest-client.js';
import { VideoIndexerRequestError } from '../../src/ports/video-indexer-client.js';
import { type HttpStub, type RecordedRequest, startHttpStub } from '../support/http-stub.js';

describe('createVideoIndexerRestClient (vs local ARM + VI stub)', () => {
  let stub: HttpStub;
  let tokenCalls: number;
  let current: Date;
  const requestedScopes: string[] = [];

  const credential = {
    getToken: (scope: string | string[]) => {
      requestedScopes.push(Array.isArray(scope) ? scope.join(',') : scope);
      return Promise.resolve({ token: 'arm-token', expiresOnTimestamp: 0 });
    },
  };

  function client() {
    return createVideoIndexerRestClient({
      credential,
      subscriptionId: 'sub-1',
      resourceGroup: 'rg-1',
      accountName: 'vidx-vi',
      accountId: 'acc-1',
      location: 'eastus',
      clock: { now: () => current },
      armEndpoint: stub.baseUrl,
      apiEndpoint: stub.baseUrl,
    });
  }

  function route(request: RecordedRequest) {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'POST' && url.pathname.endsWith('/generateAccessToken')) {
      tokenCalls += 1;
      return { body: JSON.stringify({ accessToken: `vi-token-${String(tokenCalls)}` }) };
    }
    if (request.method === 'POST' && url.pathname === '/eastus/Accounts/acc-1/Videos') {
      return { body: JSON.stringify({ id: 'vi-1', state: 'Uploaded' }) };
    }
    if (url.pathname === '/eastus/Accounts/acc-1/Videos/vi-1/Index') {
      return { body: JSON.stringify({ id: 'vi-1', state: 'Processed', videos: [] }) };
    }
    if (url.pathname === '/eastus/Accounts/acc-1/Videos/vi-1/Captions') {
      return { body: 'WEBVTT\n', contentType: 'text/vtt' };
    }
    if (url.pathname === '/eastus/Accounts/acc-1/Videos/vi-1/Thumbnails/thumb-1') {
      return { body: Buffer.from([1, 2, 3]), contentType: 'image/jpeg' };
    }
    return { status: 404, body: 'not found', contentType: 'text/plain' };
  }

  beforeAll(async () => {
    stub = await startHttpStub();
  });

  beforeEach(() => {
    tokenCalls = 0;
    current = new Date('2026-08-12T10:00:00.000Z');
    stub.respondWith(route);
  });

  afterAll(async () => {
    await stub.close();
  });

  it('submits with SAS URL, callback URL, externalId, and NoStreaming preset', async () => {
    const submitted = await client().submitVideo({
      name: 'demo.mp4',
      videoUrl: 'https://sa.blob.core.windows.net/videos/upl-1/demo.mp4?sig=abc',
      callbackUrl: 'https://pipeline.example.com/api/indexing-callback?code=k&uploadId=upl-1',
      externalId: 'upl-1',
    });

    expect(submitted).toEqual({ videoId: 'vi-1', state: 'Uploaded' });
    const submit = stub.requests.find((request) => request.url.includes('/Videos?'));
    const url = new URL(submit?.url ?? '', 'http://localhost');
    expect(url.searchParams.get('name')).toBe('demo.mp4');
    expect(url.searchParams.get('videoUrl')).toBe(
      'https://sa.blob.core.windows.net/videos/upl-1/demo.mp4?sig=abc',
    );
    expect(url.searchParams.get('callbackUrl')).toBe(
      'https://pipeline.example.com/api/indexing-callback?code=k&uploadId=upl-1',
    );
    expect(url.searchParams.get('externalId')).toBe('upl-1');
    expect(url.searchParams.get('privacy')).toBe('Private');
    expect(url.searchParams.get('streamingPreset')).toBe('NoStreaming');
    expect(submit?.headers.authorization).toBe('Bearer vi-token-1');
  });

  it('acquires the account token via ARM generateAccessToken with the managed-identity token', async () => {
    await client().getIndex('vi-1');

    const arm = stub.requests.find((request) => request.url.includes('generateAccessToken'));
    expect(arm?.url).toContain(
      '/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.VideoIndexer/accounts/vidx-vi/generateAccessToken',
    );
    expect(arm?.url).toContain('api-version=2024-01-01');
    expect(arm?.headers.authorization).toBe('Bearer arm-token');
    expect(JSON.parse(arm?.body.toString('utf8') ?? '{}')).toEqual({
      permissionType: 'Contributor',
      scope: 'Account',
    });
    expect(requestedScopes.at(-1)).toBe(`${stub.baseUrl}/.default`);
  });

  it('reuses the account token across calls and refreshes it after the reuse window', async () => {
    const vi = client();
    await vi.getIndex('vi-1');
    await vi.getCaptions('vi-1');
    expect(tokenCalls).toBe(1);

    current = new Date(current.getTime() + 51 * 60_000);
    await vi.getIndex('vi-1');
    expect(tokenCalls).toBe(2);
  });

  it('fetches captions as text and thumbnails as bytes', async () => {
    const vi = client();
    expect(await vi.getCaptions('vi-1')).toBe('WEBVTT\n');
    expect([...(await vi.getThumbnail('vi-1', 'thumb-1'))]).toEqual([1, 2, 3]);
  });

  it('throws VideoIndexerRequestError with the status for non-2xx VI responses', async () => {
    const error = await client()
      .getIndex('vi-missing')
      .then(
        () => null,
        (caught: unknown) => caught,
      );

    expect(error).toBeInstanceOf(VideoIndexerRequestError);
    expect((error as VideoIndexerRequestError).status).toBe(404);
  });

  it('throws VideoIndexerRequestError when generateAccessToken is rejected', async () => {
    stub.respondWith(() => ({ status: 403, body: '{"error":"no role"}' }));

    const error = await client()
      .getIndex('vi-1')
      .then(
        () => null,
        (caught: unknown) => caught,
      );

    expect(error).toBeInstanceOf(VideoIndexerRequestError);
    expect((error as VideoIndexerRequestError).status).toBe(403);
  });
});
