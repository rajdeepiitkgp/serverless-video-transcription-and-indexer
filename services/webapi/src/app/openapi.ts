import { createOpenApiDocument, type OpenApiDocument } from '@vidx/shared';

import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';
import { runAuthenticated } from './support.js';

let cached: OpenApiDocument | null = null;

/**
 * GET /api/openapi.json — the OpenAPI 3.1 document generated from the shared zod
 * schemas (plan §4), served unenveloped for the Scalar `/docs` page. Generation is
 * deterministic, so the document is built once per worker.
 */
export function handleOpenApi(request: ApiRequest, deps: WebApiDependencies): Promise<ApiResponse> {
  return runAuthenticated('getOpenApi', request, deps, () => {
    cached ??= createOpenApiDocument();
    return Promise.resolve({ status: 200, jsonBody: cached });
  });
}
