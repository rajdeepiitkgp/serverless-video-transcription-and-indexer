import { type DependencyHealth, type HealthStatus } from '@vidx/shared';

/**
 * Rolls per-dependency checks into the terse liveness verdict (plan §4): every
 * dependency healthy → `ok`; all of them failing → `down`; anything in between →
 * `degraded`.
 */
export function overallHealth(dependencies: readonly DependencyHealth[]): HealthStatus {
  const failing = dependencies.filter((dependency) => dependency.status !== 'ok').length;
  if (failing === 0) return 'ok';
  return failing === dependencies.length ? 'down' : 'degraded';
}
