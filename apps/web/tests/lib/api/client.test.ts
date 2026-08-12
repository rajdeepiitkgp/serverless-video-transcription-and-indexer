import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';
import * as z from 'zod';

import { ApiRequestError, fetchApi, toApiRequestError } from '@/lib/api/client';

const dataSchema = z.object({ value: z.string() });

const stubFetch = (response: Response): Mock<typeof fetch> => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchApi', () => {
  it('unwraps the { data } envelope after validating it', async () => {
    stubFetch(jsonResponse({ data: { value: 'ok' } }));
    await expect(fetchApi('/api/test', dataSchema)).resolves.toEqual({ value: 'ok' });
  });

  it('sends an accept header', async () => {
    const fetchMock = stubFetch(jsonResponse({ data: { value: 'ok' } }));
    await fetchApi('/api/test', dataSchema);
    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/test');
    expect(init?.headers).toEqual({ accept: 'application/json' });
  });

  it('surfaces the error envelope with its tracking id', async () => {
    stubFetch(
      jsonResponse(
        { error: { code: 'not_found', message: 'Video not found.', trackingId: 'VXT-a1b2c3d4' } },
        404,
      ),
    );
    const failure = await fetchApi('/api/test', dataSchema).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiRequestError);
    const requestError = failure as ApiRequestError;
    expect(requestError.code).toBe('not_found');
    expect(requestError.trackingId).toBe('VXT-a1b2c3d4');
    expect(requestError.status).toBe(404);
  });

  it('wraps non-envelope failures without inventing a tracking id', async () => {
    stubFetch(new Response('bad gateway', { status: 502 }));
    const failure = await fetchApi('/api/test', dataSchema).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiRequestError);
    const requestError = failure as ApiRequestError;
    expect(requestError.code).toBe('http_502');
    expect(requestError.trackingId).toBeNull();
  });

  it('rejects a 200 body that does not match the contract', async () => {
    stubFetch(jsonResponse({ data: { value: 42 } }));
    const failure = await fetchApi('/api/test', dataSchema).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiRequestError);
    expect((failure as ApiRequestError).code).toBe('invalid_response');
  });
});

describe('toApiRequestError', () => {
  it('passes an ApiRequestError through untouched', () => {
    const original = new ApiRequestError({
      code: 'x',
      message: 'y',
      trackingId: null,
      status: 500,
    });
    expect(toApiRequestError(original)).toBe(original);
  });

  it('wraps unknown values as a network error', () => {
    const wrapped = toApiRequestError(new TypeError('fetch failed'));
    expect(wrapped.code).toBe('network');
    expect(wrapped.message).toBe('fetch failed');
  });
});
