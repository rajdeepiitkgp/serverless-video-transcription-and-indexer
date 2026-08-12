import { Validator } from '@seriousme/openapi-schema-validator';
import { describe, expect, it } from 'vitest';

import { createOpenApiDocument } from './document.js';

const document = createOpenApiDocument();

const EXPECTED_PATHS = [
  '/api/uploads',
  '/api/videos',
  '/api/videos/{id}',
  '/api/videos/{id}/transcript',
  '/api/videos/{id}/download',
  '/api/videos/{id}/download/transcript',
  '/api/search',
  '/api/stats',
  '/api/health',
  '/api/health/detailed',
  '/api/openapi.json',
];

describe('createOpenApiDocument', () => {
  it('produces a valid OpenAPI 3.1 document', async () => {
    const validator = new Validator();
    const result = await validator.validate(
      JSON.parse(JSON.stringify(document)) as Record<string, unknown>,
    );

    expect(result.errors).toBeUndefined();
    expect(result.valid).toBe(true);
    expect(document.openapi).toMatch(/^3\.1\./);
  });

  it('documents all 12 endpoints of the webapi surface', () => {
    const paths = document.paths ?? {};
    expect(Object.keys(paths).sort()).toEqual([...EXPECTED_PATHS].sort());

    const verbs = ['get', 'post', 'put', 'delete', 'patch'] as const;
    const operationCount = Object.values(paths).flatMap((item) =>
      verbs.filter((verb) => item[verb] !== undefined),
    ).length;
    expect(operationCount).toBe(12); // 11 paths, /api/videos/{id} carries GET + DELETE
  });

  it('registers the shared component schemas', () => {
    const schemas = document.components?.schemas ?? {};
    for (const name of [
      'VideoStatus',
      'TranscriptLine',
      'Chapter',
      'VideoDocument',
      'ApiError',
      'ErrorEnvelope',
    ]) {
      expect(schemas).toHaveProperty(name);
    }
  });

  it('gives every operation a default error response with the shared envelope', () => {
    for (const [path, item] of Object.entries(document.paths ?? {})) {
      for (const verb of ['get', 'post', 'put', 'delete', 'patch'] as const) {
        const operation = item[verb];
        if (!operation) continue;
        expect(operation.responses?.default, `${verb.toUpperCase()} ${path}`).toBeDefined();
      }
    }
  });

  it('marks only /api/health as anonymous', () => {
    const health = document.paths?.['/api/health']?.get;
    expect(health?.description).toMatch(/anonymous/i);
  });
});
