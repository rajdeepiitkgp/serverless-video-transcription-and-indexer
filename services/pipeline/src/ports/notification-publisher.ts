import { type VideoNotification } from '../core/notification.js';

/** Discord webhook (plan §4). Failures are logged warnings — never pipeline failures. */
export interface NotificationPublisher {
  publish(notification: VideoNotification): Promise<void>;
}
