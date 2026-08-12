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
    stubFetch(new Response('missing', { status: 404 }));
    const failure = await fetchApi('/api/test', dataSchema).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiRequestError);
    const requestError = failure as ApiRequestError;
    expect(requestError.code).toBe('http_404');
    expect(requestError.trackingId).toBeNull();
  });

  it('rejects a 200 body that does not match the contract', async () => {
    stubFetch(jsonResponse({ data: { value: 42 } }));
    const failure = await fetchApi('/api/test', dataSchema).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiRequestError);
    expect((failure as ApiRequestError).code).toBe('invalid_response');
  });
});

describe('fetchApi retry (idempotent GETs only)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const settle = (promise: Promise<unknown>): Promise<unknown> =>
    promise.catch((error: unknown) => error);

  it('retries a 5xx GET and succeeds on a later attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ data: { value: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = settle(fetchApi('/api/test', dataSchema));
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toEqual({ value: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a network failure and succeeds on a later attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ data: { value: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = settle(fetchApi('/api/test', dataSchema));
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toEqual({ value: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honors a Retry-After header before the next attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response('slow down', { status: 429, headers: { 'retry-after': '3' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { value: 'ok' } }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = settle(fetchApi('/api/test', dataSchema));
    await vi.advanceTimersByTimeAsync(2_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(promise).resolves.toEqual({ value: 'ok' });
  });

  it('gives up after two retries', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('busy', { status: 503 })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const promise = settle(fetchApi('/api/test', dataSchema));
    await vi.advanceTimersByTimeAsync(30_000);
    const failure = await promise;
    expect(failure).toBeInstanceOf(ApiRequestError);
    expect((failure as ApiRequestError).code).toBe('http_503');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 400 GET', async () => {
    const fetchMock = stubFetch(new Response('bad request', { status: 400 }));
    const failure = await fetchApi('/api/test', dataSchema).catch((error: unknown) => error);
    expect((failure as ApiRequestError).code).toBe('http_400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never retries POST or DELETE, even on 5xx', async () => {
    const fetchMock = stubFetch(new Response('busy', { status: 503 }));
    await fetchApi('/api/uploads', dataSchema, { method: 'POST', body: {} }).catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchApi('/api/videos/x', dataSchema, { method: 'DELETE' }).catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops retrying once the caller aborts', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('busy', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = settle(fetchApi('/api/test', dataSchema, { signal: controller.signal }));
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(30_000);
    await promise;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serializes a JSON body for POST', async () => {
    const fetchMock = stubFetch(jsonResponse({ data: { value: 'ok' } }, 201));
    await fetchApi('/api/uploads', dataSchema, { method: 'POST', body: { fileName: 'a.mp4' } });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(init?.body).toBe(JSON.stringify({ fileName: 'a.mp4' }));
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
