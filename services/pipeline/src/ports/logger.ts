/**
 * Structured logging port. Properties become App Insights custom dimensions —
 * always stamp `uploadId`/`videoId`/`trackingId` so a video's whole timeline
 * stitches into one story (plan §6, docs/style-guide.md).
 */
export type LogProperties = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  info(message: string, properties?: LogProperties): void;
  warn(message: string, properties?: LogProperties): void;
  error(message: string, properties?: LogProperties): void;
}
