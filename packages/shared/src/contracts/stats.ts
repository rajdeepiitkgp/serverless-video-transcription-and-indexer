import * as z from 'zod';

const count = z.number().int().nonnegative();
const rate = z.number().min(0).max(1);

/**
 * GET /api/stats — dashboard aggregates (plan §4): totals, processed/failed rates,
 * average indexing time, and minutes indexed this month (tracks the VI free-hours
 * budget).
 */
export const statsResponseSchema = z
  .object({
    totalVideos: count,
    statusCounts: z.object({
      Uploaded: count,
      Indexing: count,
      Processed: count,
      Failed: count,
    }),
    processedRate: rate,
    failedRate: rate,
    avgIndexingSeconds: z.number().nonnegative().nullable(),
    minutesIndexedThisMonth: z.number().nonnegative(),
  })
  .meta({ id: 'StatsResponse' });

export type StatsResponse = z.infer<typeof statsResponseSchema>;
