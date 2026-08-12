import {
  detailedHealthResponseSchema,
  envelope,
  errorEnvelopeSchema,
  healthResponseSchema,
} from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { handleDetailedHealth, handleHealth } from '../../src/app/health.js';
import { apiRequest } from '../support/builders.js';
import { testDependencies } from '../support/deps.js';

describe('handleHealth (anonymous)', () => {
  it('answers ok without authentication and leaks nothing but the status', async () => {
    const result = await handleHealth(apiRequest({ principal: null }), testDependencies());

    expect(result.status).toBe(200);
    const { data } = envelope(healthResponseSchema).parse(result.jsonBody);
    expect(data).toEqual({ status: 'ok' });
  });

  it('degrades when one dependency is down but still answers 200', async () => {
    const deps = testDependencies();
    deps.probes.cosmosError = new Error('cosmos unreachable');

    const result = await handleHealth(apiRequest({ principal: null }), deps);

    expect(result.status).toBe(200);
    expect(envelope(healthResponseSchema).parse(result.jsonBody).data.status).toBe('degraded');
  });

  it('answers 503 when every dependency is down, so the availability alert fires', async () => {
    const deps = testDependencies();
    deps.probes.cosmosError = new Error('cosmos unreachable');
    deps.probes.storageError = new Error('storage unreachable');

    const result = await handleHealth(apiRequest({ principal: null }), deps);

    expect(result.status).toBe(503);
    expect(errorEnvelopeSchema.parse(result.jsonBody).error.code).toBe('unhealthy');
  });

  it('treats a hanging dependency as down (probe timeout)', async () => {
    const deps = testDependencies();
    deps.probes.cosmosHangs = true;
    deps.probes.storageHangs = true;

    const result = await handleHealth(apiRequest({ principal: null }), deps);

    expect(result.status).toBe(503);
  });
});

describe('handleDetailedHealth (signed-in)', () => {
  it('reports per-dependency status with latencies (contract)', async () => {
    const result = await handleDetailedHealth(apiRequest(), testDependencies());

    expect(result.status).toBe(200);
    const { data } = envelope(detailedHealthResponseSchema).parse(result.jsonBody);
    expect(data.status).toBe('ok');
    expect(data.checkedAt).toBe('2026-08-12T10:00:00.000Z');
    expect(data.dependencies).toEqual([
      { name: 'cosmos', status: 'ok', latencyMs: 0 },
      { name: 'storage', status: 'ok', latencyMs: 0 },
    ]);
  });

  it('marks a failing dependency down with a null latency and logs the cause', async () => {
    const deps = testDependencies();
    deps.probes.storageError = new Error('storage unreachable');

    const result = await handleDetailedHealth(apiRequest(), deps);

    const { data } = envelope(detailedHealthResponseSchema).parse(result.jsonBody);
    expect(data.status).toBe('degraded');
    expect(data.dependencies).toContainEqual({ name: 'storage', status: 'down', latencyMs: null });
    expect(deps.logger.messages('warn')).toContain('Health probe failed');
  });
});
