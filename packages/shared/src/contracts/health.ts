import * as z from 'zod';

export const healthStatusSchema = z.enum(['ok', 'degraded', 'down']).meta({ id: 'HealthStatus' });

export type HealthStatus = z.infer<typeof healthStatusSchema>;

/**
 * GET /api/health — the only anonymous route (plan §4). Deliberately terse: no
 * versions, no config, no dependency names — nothing leakable.
 */
export const healthResponseSchema = z
  .object({ status: healthStatusSchema })
  .meta({ id: 'HealthResponse' });

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const dependencyHealthSchema = z
  .object({
    name: z.enum(['cosmos', 'storage']),
    status: healthStatusSchema,
    latencyMs: z.number().nonnegative().nullable(),
  })
  .meta({ id: 'DependencyHealth' });

export type DependencyHealth = z.infer<typeof dependencyHealthSchema>;

/** GET /api/health/detailed — per-dependency checks with latencies (signed-in only). */
export const detailedHealthResponseSchema = z
  .object({
    status: healthStatusSchema,
    checkedAt: z.iso.datetime(),
    dependencies: z.array(dependencyHealthSchema),
  })
  .meta({ id: 'DetailedHealthResponse' });

export type DetailedHealthResponse = z.infer<typeof detailedHealthResponseSchema>;
