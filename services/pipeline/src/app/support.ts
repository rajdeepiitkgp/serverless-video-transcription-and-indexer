import * as z from 'zod';

import { type VideoNotification } from '../core/notification.js';
import { type DiagnosticsStore } from '../ports/diagnostics-store.js';
import { type Logger } from '../ports/logger.js';
import { type NotificationPublisher } from '../ports/notification-publisher.js';
import { VideoIndexerRequestError } from '../ports/video-indexer-client.js';

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Retrying can't fix a 4xx rejection or a payload that no longer matches our schema —
 * those fail the video (terminal Failed + ❌ embed). Anything else is treated as
 * transient: the handler rethrows and Event Grid redelivers (dead-letter alerts are
 * the backstop, plan §8). 408/429 are explicitly transient despite being 4xx.
 */
export function isDeterministicFailure(error: unknown): boolean {
  if (error instanceof z.ZodError) return true;
  if (error instanceof VideoIndexerRequestError) {
    return (
      error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429
    );
  }
  return false;
}

/** Diagnostics capture must never fail the pipeline (plan §7). */
export async function captureDiagnostic(
  deps: { diagnostics: DiagnosticsStore; logger: Logger },
  uploadId: string,
  entryName: string,
  body: string | Uint8Array,
  contentType = 'application/json',
): Promise<void> {
  try {
    await deps.diagnostics.write(uploadId, entryName, body, contentType);
  } catch (error) {
    deps.logger.warn('Diagnostics capture failed; continuing', {
      uploadId,
      entryName,
      error: errorMessage(error),
    });
  }
}

/** Notification failures are logged warnings — never pipeline failures (plan §4). */
export async function notifySafely(
  deps: { notifications: NotificationPublisher; logger: Logger },
  notification: VideoNotification,
  uploadId: string,
): Promise<void> {
  try {
    await deps.notifications.publish(notification);
  } catch (error) {
    deps.logger.warn('Discord notification failed; continuing', {
      uploadId,
      error: errorMessage(error),
    });
  }
}

/** Strips query strings (SAS signatures, function keys) before anything is persisted or logged. */
export function redactUrlSecrets(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.search === '' ? url : `${parsed.origin}${parsed.pathname}?<redacted>`;
  } catch {
    return '<unparseable-url>';
  }
}
