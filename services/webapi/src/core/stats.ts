import { type StatsResponse, statsResponseSchema, type VideoDocument } from '@vidx/shared';

/**
 * Dashboard aggregates (plan §4): totals, terminal-state rates, average indexing
 * time, and minutes indexed this month — the last one tracks the VI free-hours
 * budget, so it counts calendar-month (UTC) processed videos by duration.
 */
export function computeStats(documents: readonly VideoDocument[], now: Date): StatsResponse {
  const statusCounts = { Uploaded: 0, Indexing: 0, Processed: 0, Failed: 0 };
  const indexingDurations: number[] = [];
  let minutesIndexedThisMonth = 0;

  for (const document of documents) {
    statusCounts[document.status] += 1;

    if (document.status !== 'Processed' || document.processedAt === undefined) continue;

    const processedAt = new Date(document.processedAt);
    if (document.submittedAt !== undefined) {
      const seconds = (processedAt.getTime() - new Date(document.submittedAt).getTime()) / 1000;
      if (seconds >= 0) indexingDurations.push(seconds);
    }
    if (
      processedAt.getUTCFullYear() === now.getUTCFullYear() &&
      processedAt.getUTCMonth() === now.getUTCMonth()
    ) {
      minutesIndexedThisMonth += (document.durationInSeconds ?? 0) / 60;
    }
  }

  const total = documents.length;
  return statsResponseSchema.parse({
    totalVideos: total,
    statusCounts,
    processedRate: total === 0 ? 0 : statusCounts.Processed / total,
    failedRate: total === 0 ? 0 : statusCounts.Failed / total,
    avgIndexingSeconds:
      indexingDurations.length === 0
        ? null
        : indexingDurations.reduce((sum, seconds) => sum + seconds, 0) / indexingDurations.length,
    minutesIndexedThisMonth,
  });
}
