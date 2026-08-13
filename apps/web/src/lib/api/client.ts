import { errorEnvelopeSchema } from '@vidx/shared';
import * as z from 'zod';

const successEnvelopeSchema = z.object({ data: z.unknown() });

/**
 * A failed API call. `trackingId` is present whenever the webapi returned its error
 * envelope — the UI surfaces it verbatim ("quote VXT-… to support", plan §6).
 */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly trackingId: string | null;
  readonly status: number;

  constructor(options: {
    code: string;
    message: string;
    trackingId: string | null;
    status: number;
  }) {
    super(options.message);
    this.name = 'ApiRequestError';
    this.code = options.code;
    this.trackingId = options.trackingId;
    this.status = options.status;
  }
}

/** Narrows any thrown value to an ApiRequestError for state storage. */
export function toApiRequestError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error;
  }
  const message = error instanceof Error ? error.message : 'Request failed';
  return new ApiRequestError({ code: 'network', message, trackingId: null, status: 0 });
}

/** One-line error text with the support ID when present, for toasts and list rows. */
export function describeApiError(cause: unknown): string {
  const error = toApiRequestError(cause);
  return error.trackingId === null
    ? error.message
    : `${error.message} (support ID ${error.trackingId})`;
}

export interface FetchApiInit {
  /**
   * Defaults to GET. POST/DELETE calls are never retried: `POST /api/uploads`
   * creates a document + SAS per call (a retry would orphan documents), and DELETE
   * must run exactly as often as the user asked.
   */
  method?: 'GET' | 'POST' | 'DELETE';
  /** JSON-serialized request body. */
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Bounded retry for idempotent GETs only: transient faults (network failures,
 * 408/429/5xx) get 2 retries with exponential backoff + jitter, honoring a
 * `Retry-After` header when the server sends one.
 */
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 10_000;

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter !== null) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_DELAY_MS);
    }
    const at = Date.parse(retryAfter);
    if (!Number.isNaN(at)) {
      return Math.min(Math.max(0, at - Date.now()), MAX_DELAY_MS);
    }
  }
  const backoff = BASE_DELAY_MS * 2 ** attempt;
  // Full backoff plus up to 50% jitter so simultaneous tabs don't retry in lockstep.
  return backoff + Math.random() * backoff * 0.5;
}

function abortReason(signal: AbortSignal | undefined): Error {
  const reason: unknown = signal?.reason;
  return reason instanceof Error ? reason : new Error('The request was aborted.');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function fetchWithRetry(path: string, init: FetchApiInit | undefined): Promise<Response> {
  const method = init?.method ?? 'GET';
  const request: RequestInit = {
    method,
    headers: {
      accept: 'application/json',
      ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    ...(init?.signal === undefined ? {} : { signal: init.signal }),
  };

  for (let attempt = 0; ; attempt += 1) {
    const retriesLeft = method === 'GET' && attempt < MAX_RETRIES;
    let response: Response;
    try {
      response = await fetch(path, request);
    } catch (error) {
      if (!retriesLeft || init?.signal?.aborted === true) {
        throw error;
      }
      await sleep(retryDelayMs(attempt, null), init?.signal);
      continue;
    }
    if (!response.ok && retriesLeft && isRetryableStatus(response.status)) {
      await sleep(retryDelayMs(attempt, response.headers.get('retry-after')), init?.signal);
      continue;
    }
    return response;
  }
}

/**
 * Fetches an API route and validates the `{ data: … }` envelope against the shared
 * zod contract. All server data flows through here (docs/style-guide.md): components
 * use the hooks in `hooks.ts`, never `fetch` directly.
 */
async function toRequestFailure(response: Response): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (parsed.success) {
    return new ApiRequestError({ ...parsed.data.error, status: response.status });
  }
  return new ApiRequestError({
    code: `http_${String(response.status)}`,
    message: 'The request failed. Try again, and contact support if it keeps failing.',
    trackingId: null,
    status: response.status,
  });
}

export async function fetchApi<T extends z.ZodType>(
  path: string,
  dataSchema: T,
  init?: FetchApiInit,
): Promise<z.output<T>> {
  const response = await fetchWithRetry(path, init);
  if (!response.ok) {
    throw await toRequestFailure(response);
  }
  const body: unknown = await response.json().catch(() => null);

  // Two steps ({ data } shape, then the contract) so the generic stays inferable.
  const unwrapped = successEnvelopeSchema.safeParse(body);
  const parsed = unwrapped.success ? dataSchema.safeParse(unwrapped.data.data) : null;
  if (!parsed?.success) {
    throw new ApiRequestError({
      code: 'invalid_response',
      message: 'The server returned an unexpected response shape.',
      trackingId: null,
      status: response.status,
    });
  }
  return parsed.data;
}

/** A file streamed by the API: the raw bytes plus the name the server chose for it. */
export interface ApiFileResponse {
  blob: Blob;
  fileName: string | null;
}

const FILENAME_STAR = /filename\*=UTF-8''([^;]+)/i;
const FILENAME_QUOTED = /filename="([^"]*)"/i;

/** Download name from an RFC 6266 `attachment` disposition; `filename*` wins when present. */
function fileNameFromDisposition(disposition: string | null): string | null {
  const star = disposition === null ? null : FILENAME_STAR.exec(disposition);
  if (star?.[1] !== undefined) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // Malformed percent-encoding — fall back to the ASCII filename.
    }
  }
  const quoted = disposition === null ? null : FILENAME_QUOTED.exec(disposition);
  return quoted?.[1] ?? null;
}

/**
 * Fetches an API route that streams a file body (`content-disposition: attachment`)
 * instead of the `{ data: … }` envelope — the transcript downloads. Failures still
 * arrive as the JSON error envelope, so they surface the same tracking IDs.
 */
export async function fetchApiFile(path: string, init?: FetchApiInit): Promise<ApiFileResponse> {
  const response = await fetchWithRetry(path, init);
  if (!response.ok) {
    throw await toRequestFailure(response);
  }
  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response.headers.get('content-disposition')),
  };
}
