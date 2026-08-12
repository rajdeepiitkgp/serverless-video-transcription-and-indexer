import { type TrackingId } from '@vidx/shared';

/** Injectable id source: upload ids and support tracking ids (plan §6). */
export interface IdGenerator {
  uploadId(): string;
  trackingId(): TrackingId;
}
