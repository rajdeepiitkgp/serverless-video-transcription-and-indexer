import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type HttpStub, startHttpStub } from '../../test-support/http-stub.js';
import { type VideoNotification } from '../core/notification.js';
import { createDiscordNotificationPublisher } from './discord-notification-publisher.js';

const embedOnly: VideoNotification = {
  embeds: [
    {
      title: '✅ demo.mp4',
      color: 0x57f287,
      fields: [{ name: 'Duration', value: '0:02:07', inline: true }],
    },
  ],
};

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);

const withThumbnail: VideoNotification = {
  embeds: [
    {
      title: '✅ demo.mp4',
      color: 0x57f287,
      fields: [],
      thumbnail: { url: 'attachment://thumbnail.jpg' },
    },
  ],
  attachment: { fileName: 'thumbnail.jpg', contentType: 'image/jpeg', data: jpegBytes },
};

describe('createDiscordNotificationPublisher (vs local webhook stub)', () => {
  let stub: HttpStub;

  beforeAll(async () => {
    stub = await startHttpStub();
  });

  beforeEach(() => {
    stub.respondWith(() => ({ status: 204, body: '' }));
  });

  afterAll(async () => {
    await stub.close();
  });

  it('posts embeds as JSON when there is no attachment', async () => {
    const publisher = createDiscordNotificationPublisher(`${stub.baseUrl}/webhook`);

    await publisher.publish(embedOnly);

    const request = stub.requests.at(-1);
    expect(request?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(request?.body.toString('utf8') ?? '{}')).toEqual({
      embeds: [
        {
          title: '✅ demo.mp4',
          color: 0x57f287,
          fields: [{ name: 'Duration', value: '0:02:07', inline: true }],
        },
      ],
    });
  });

  it('posts multipart with payload_json + files[0] when a thumbnail is attached (plan §4)', async () => {
    const publisher = createDiscordNotificationPublisher(`${stub.baseUrl}/webhook`);

    await publisher.publish(withThumbnail);

    const request = stub.requests.at(-1);
    expect(request?.headers['content-type']).toContain('multipart/form-data');
    const body = request?.body ?? Buffer.alloc(0);
    expect(body.toString('utf8')).toContain('name="payload_json"');
    expect(body.toString('utf8')).toContain('attachment://thumbnail.jpg');
    expect(body.toString('utf8')).toContain('filename="thumbnail.jpg"');
    expect(body.includes(Buffer.from(jpegBytes))).toBe(true);
  });

  it('throws on a non-2xx webhook response (callers downgrade it to a warning)', async () => {
    stub.respondWith(() => ({ status: 404, body: '{"message":"Unknown Webhook"}' }));
    const publisher = createDiscordNotificationPublisher(`${stub.baseUrl}/webhook`);

    await expect(publisher.publish(embedOnly)).rejects.toThrow('Discord webhook responded 404');
  });
});
