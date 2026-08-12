import * as z from 'zod';

/**
 * Event Grid *event schema* envelope (not CloudEvents — both our system-topic
 * subscription and the custom topic use the default Event Grid schema).
 */
const eventGridEventShape = {
  id: z.string().min(1),
  topic: z.string().optional(),
  subject: z.string(),
  eventType: z.string().min(1),
  eventTime: z.iso.datetime(),
  dataVersion: z.string().optional(),
  metadataVersion: z.string().optional(),
};

export const eventGridEventSchema = z.object({ ...eventGridEventShape, data: z.unknown() });

export type EventGridEvent = z.infer<typeof eventGridEventSchema>;

/** Envelope with a typed, validated `data` payload. */
export function eventGridEventOf<T extends z.ZodType>(
  dataSchema: T,
): z.ZodObject<typeof eventGridEventShape & { data: T }> {
  return z.object({ ...eventGridEventShape, data: dataSchema });
}
