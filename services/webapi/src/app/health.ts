import {
  type DependencyHealth,
  type DetailedHealthResponse,
  type HealthResponse,
} from '@vidx/shared';

import { overallHealth } from '../core/health.js';
import { type WebApiDependencies } from './dependencies.js';
import { type ApiRequest, type ApiResponse } from './http.js';
import { apiError, errorMessage, ok, runAnonymous, runAuthenticated } from './support.js';

async function checkDependency(
  name: DependencyHealth['name'],
  probe: () => Promise<void>,
  deps: WebApiDependencies,
): Promise<DependencyHealth> {
  const timeoutMs = deps.options.healthProbeTimeoutMs;
  const startedAt = deps.clock.now().getTime();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${name} probe timed out after ${String(timeoutMs)}ms`));
        }, timeoutMs);
      }),
    ]);
    return { name, status: 'ok', latencyMs: deps.clock.now().getTime() - startedAt };
  } catch (error) {
    deps.logger.warn('Health probe failed', { dependency: name, error: errorMessage(error) });
    return { name, status: 'down', latencyMs: null };
  } finally {
    clearTimeout(timer);
  }
}

function checkAll(deps: WebApiDependencies): Promise<DependencyHealth[]> {
  return Promise.all([
    checkDependency('cosmos', () => deps.probes.cosmos(), deps),
    checkDependency('storage', () => deps.probes.storage(), deps),
  ]);
}

/**
 * GET /api/health — the only anonymous route (plan §4), probed by the availability
 * test (plan §8). Terse by design: nothing leakable. Answers 200 while at least one
 * dependency is up (`ok`/`degraded`) and 503 when everything is down, so the
 * availability alert fires on real outages without flapping on partial ones.
 */
export function handleHealth(request: ApiRequest, deps: WebApiDependencies): Promise<ApiResponse> {
  return runAnonymous('getHealth', request, deps, async () => {
    const status = overallHealth(await checkAll(deps));
    if (status === 'down') {
      return apiError(503, 'unhealthy', 'Service dependencies are down.', deps.ids.trackingId());
    }
    const response: HealthResponse = { status };
    return ok(response);
  });
}

/** GET /api/health/detailed — per-dependency checks with latencies (signed-in only). */
export function handleDetailedHealth(
  request: ApiRequest,
  deps: WebApiDependencies,
): Promise<ApiResponse> {
  return runAuthenticated('getDetailedHealth', request, deps, async () => {
    const dependencies = await checkAll(deps);
    const response: DetailedHealthResponse = {
      status: overallHealth(dependencies),
      checkedAt: deps.clock.now().toISOString(),
      dependencies,
    };
    return ok(response);
  });
}
