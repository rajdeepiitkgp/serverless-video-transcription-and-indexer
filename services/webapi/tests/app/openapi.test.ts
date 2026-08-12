import { describe, expect, it } from 'vitest';

import { handleOpenApi } from '../../src/app/openapi.js';
import { apiRequest } from '../support/builders.js';
import { testDependencies } from '../support/deps.js';

describe('handleOpenApi', () => {
  it('serves the shared OpenAPI 3.1 document unenveloped', async () => {
    const result = await handleOpenApi(apiRequest(), testDependencies());

    expect(result.status).toBe(200);
    const document = result.jsonBody as { openapi: string; paths: Record<string, unknown> };
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths)).toContain('/api/uploads');
    expect(result.jsonBody).not.toHaveProperty('data');
  });

  it('serves the same instance on repeat calls (built once per worker)', async () => {
    const deps = testDependencies();
    const first = await handleOpenApi(apiRequest(), deps);
    const second = await handleOpenApi(apiRequest(), deps);

    expect(second.jsonBody).toBe(first.jsonBody);
  });
});
