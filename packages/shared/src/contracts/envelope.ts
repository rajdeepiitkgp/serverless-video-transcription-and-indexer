import * as z from 'zod';

/**
 * User-facing tracking id (`VXT-a1b2c3d4`) — quoted verbatim in support requests and
 * stamped on every error path (plan §6, docs/style-guide.md). Lowercase hex only, so
 * what a user reads over the phone matches what App Insights stores.
 */
export const TRACKING_ID_PATTERN = /^VXT-[0-9a-f]{8}$/;

export const trackingIdSchema = z
  .string()
  .regex(TRACKING_ID_PATTERN)
  .meta({ id: 'TrackingId', description: 'Support tracking id, e.g. VXT-a1b2c3d4' });

export type TrackingId = z.infer<typeof trackingIdSchema>;

// Web Crypto is global in both browsers and Node ≥19; declared minimally here so the
// build stays lib-agnostic (the emit tsconfig loads neither the DOM lib nor node types).
declare const crypto: { getRandomValues: <T extends ArrayBufferView>(array: T) => T };

/** Generates a tracking id. */
export function createTrackingId(): TrackingId {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `VXT-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export const apiErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    trackingId: trackingIdSchema,
  })
  .meta({ id: 'ApiError' });

export type ApiError = z.infer<typeof apiErrorSchema>;

/** Error envelope returned by every failing endpoint. Never carries stack traces. */
export const errorEnvelopeSchema = z.object({ error: apiErrorSchema }).meta({
  id: 'ErrorEnvelope',
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

/** Success envelope: every 2xx JSON body is `{ data: … }`. */
export function envelope<T extends z.ZodType>(dataSchema: T): z.ZodObject<{ data: T }> {
  return z.object({ data: dataSchema });
}
