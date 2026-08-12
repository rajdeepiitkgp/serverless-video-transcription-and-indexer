import * as z from 'zod';

/**
 * App settings contract (wired by infra in M5; sample in local.settings.sample.json).
 * Zod at the boundary: a misconfigured app fails loudly at first invocation instead
 * of misbehaving quietly. Endpoints only — auth everywhere is the app's
 * system-assigned managed identity, and the webapi holds no secrets at all (plan §5).
 */
const webApiConfigSchema = z.object({
  STORAGE_BLOB_ENDPOINT: z.url(),
  VIDEOS_CONTAINER: z.string().min(1).default('videos'),
  RESULTS_CONTAINER: z.string().min(1).default('results'),
  COSMOS_ENDPOINT: z.url(),
  COSMOS_DATABASE: z.string().min(1).default('VideoAnalytics'),
  COSMOS_CONTAINER: z.string().min(1).default('VideoMetadata'),
  HEALTH_PROBE_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
});

export type WebApiConfig = z.infer<typeof webApiConfigSchema>;

export function loadWebApiConfig(env: Readonly<Record<string, string | undefined>>): WebApiConfig {
  return webApiConfigSchema.parse(env);
}
