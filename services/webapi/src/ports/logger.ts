/**
 * Structured logging port. Properties become App Insights custom dimensions —
 * every authenticated request logs who (`userId`/`userDetails`), what operation,
 * and any error path's `trackingId` (plan §6 audit trail, docs/style-guide.md).
 */
export type LogProperties = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  info(message: string, properties?: LogProperties): void;
  warn(message: string, properties?: LogProperties): void;
  error(message: string, properties?: LogProperties): void;
}
