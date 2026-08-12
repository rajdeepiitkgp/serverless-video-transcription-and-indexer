import { type ErrorEnvelope, type TrackingId } from '@vidx/shared';

import { type ClientPrincipal, parseClientPrincipal } from '../core/principal.js';
import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';

/** The closed set of machine-readable error codes the API emits. */
export type ApiErrorCode =
  | 'validation_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'not_ready'
  | 'unhealthy'
  | 'internal_error';

export function ok(data: unknown): ApiResponse {
  return { status: 200, jsonBody: { data } };
}

export function created(data: unknown): ApiResponse {
  return { status: 201, jsonBody: { data } };
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  trackingId: TrackingId,
): ApiResponse {
  const jsonBody: ErrorEnvelope = { error: { code, message, trackingId } };
  return { status, jsonBody };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type AuthenticatedHandler = (
  principal: ClientPrincipal,
  request: ApiRequest,
  deps: WebApiDependencies,
) => Promise<ApiResponse>;

export type AnonymousHandler = (
  request: ApiRequest,
  deps: WebApiDependencies,
) => Promise<ApiResponse>;

async function guard(
  operation: string,
  deps: WebApiDependencies,
  execute: () => Promise<ApiResponse>,
): Promise<ApiResponse> {
  try {
    return await execute();
  } catch (error) {
    const trackingId = deps.ids.trackingId();
    deps.logger.error('Unhandled API error', {
      operation,
      trackingId,
      error: errorMessage(error),
    });
    return apiError(
      500,
      'internal_error',
      `Something went wrong on our side. Quote ${trackingId} to support.`,
      trackingId,
    );
  }
}

/**
 * Wraps every signed-in endpoint: parses the SWA client principal (the
 * authentication step — plan §4), writes the who/what audit line on every request
 * (plan §6), and converts unexpected failures into a 500 envelope whose trackingId
 * is also logged, never leaking the underlying error to the client.
 */
export function runAuthenticated(
  operation: string,
  request: ApiRequest,
  deps: WebApiDependencies,
  handler: AuthenticatedHandler,
): Promise<ApiResponse> {
  return guard(operation, deps, async () => {
    const principal = parseClientPrincipal(request.principalHeader);
    if (principal === null) {
      const trackingId = deps.ids.trackingId();
      deps.logger.warn('Rejected anonymous request', { operation, trackingId });
      return apiError(401, 'unauthorized', 'Sign in to use this API.', trackingId);
    }

    deps.logger.info('API request', {
      operation,
      userId: principal.userId,
      userDetails: principal.userDetails,
    });
    return handler(principal, request, deps);
  });
}

/** Wraps the anonymous health endpoint: same error boundary, no principal gate. */
export function runAnonymous(
  operation: string,
  request: ApiRequest,
  deps: WebApiDependencies,
  handler: AnonymousHandler,
): Promise<ApiResponse> {
  return guard(operation, deps, () => handler(request, deps));
}
