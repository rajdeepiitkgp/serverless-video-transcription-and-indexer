import { type TrackingId } from '@vidx/shared';

/** Injectable id source: Event Grid event ids and support tracking ids (plan §6). */
export interface IdGenerator {
  eventId(): string;
  trackingId(): TrackingId;
}
