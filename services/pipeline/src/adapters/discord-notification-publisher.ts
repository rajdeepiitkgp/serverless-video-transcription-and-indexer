import { type VideoNotification } from '../core/notification.js';
import { type NotificationPublisher } from '../ports/notification-publisher.js';

/**
 * Discord webhook adapter (plan §4). Embeds post as JSON; when a thumbnail is
 * attached it switches to multipart with `payload_json` + `files[0]`, so the embed
 * can reference `attachment://…` without any public thumbnail URL.
 */
export function createDiscordNotificationPublisher(webhookUrl: string): NotificationPublisher {
  return {
    async publish(notification: VideoNotification): Promise<void> {
      let response: Response;
      if (notification.attachment === undefined) {
        response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ embeds: notification.embeds }),
        });
      } else {
        const form = new FormData();
        form.append('payload_json', JSON.stringify({ embeds: notification.embeds }));
        form.append(
          'files[0]',
          new Blob([Buffer.from(notification.attachment.data)], {
            type: notification.attachment.contentType,
          }),
          notification.attachment.fileName,
        );
        response = await fetch(webhookUrl, { method: 'POST', body: form });
      }

      if (!response.ok) {
        // Body intentionally not read into the error: keep webhook responses out of logs.
        throw new Error(`Discord webhook responded ${String(response.status)}`);
      }
    },
  };
}
