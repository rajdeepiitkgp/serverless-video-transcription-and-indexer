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

/**
 * Fetches an API route and validates the `{ data: … }` envelope against the shared
 * zod contract. All server data flows through here (docs/style-guide.md): components
 * use the hooks in `hooks.ts`, never `fetch` directly.
 */
export async function fetchApi<T extends z.ZodType>(
  path: string,
  dataSchema: T,
  init?: { signal?: AbortSignal },
): Promise<z.output<T>> {
  const response = await fetch(path, {
    headers: { accept: 'application/json' },
    ...(init?.signal === undefined ? {} : { signal: init.signal }),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(body);
    if (parsed.success) {
      throw new ApiRequestError({ ...parsed.data.error, status: response.status });
    }
    throw new ApiRequestError({
      code: `http_${String(response.status)}`,
      message: 'The request failed. Try again, and contact support if it keeps failing.',
      trackingId: null,
      status: response.status,
    });
  }

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
