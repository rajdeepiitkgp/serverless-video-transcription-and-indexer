import * as z from 'zod';

/**
 * App settings contract (wired by infra in M5; sample in local.settings.sample.json).
 * Zod at the boundary: a misconfigured app fails loudly at first invocation instead
 * of misbehaving quietly. Endpoints only — auth everywhere is the app's system-assigned
 * managed identity, and the sole secret is the Discord webhook URL (plan §5).
 */
const pipelineConfigSchema = z.object({
  STORAGE_BLOB_ENDPOINT: z.url(),
  VIDEOS_CONTAINER: z.string().min(1).default('videos'),
  RESULTS_CONTAINER: z.string().min(1).default('results'),
  COSMOS_ENDPOINT: z.url(),
  COSMOS_DATABASE: z.string().min(1).default('VideoAnalytics'),
  COSMOS_CONTAINER: z.string().min(1).default('VideoMetadata'),
  EVENT_GRID_TOPIC_ENDPOINT: z.url(),
  VI_SUBSCRIPTION_ID: z.string().min(1),
  VI_RESOURCE_GROUP: z.string().min(1),
  VI_ACCOUNT_NAME: z.string().min(1),
  VI_ACCOUNT_ID: z.string().min(1),
  VI_LOCATION: z.string().min(1),
  /** IndexingCallback function URL incl. function key — known only to VI (plan §2). */
  VI_CALLBACK_URL: z.url(),
  /** Escape hatch for ARM api-version drift (plan §14 risk table). */
  VI_ARM_API_VERSION: z.string().min(1).optional(),
  DISCORD_WEBHOOK_URL: z.url(),
  WEB_BASE_URL: z.url().optional(),
  APP_INSIGHTS_PORTAL_URL: z.url().optional(),
});

export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;

export function loadPipelineConfig(
  env: Readonly<Record<string, string | undefined>>,
): PipelineConfig {
  return pipelineConfigSchema.parse(env);
}
