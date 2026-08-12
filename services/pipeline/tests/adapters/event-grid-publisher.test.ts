import { AzureKeyCredential, EventGridPublisherClient } from '@azure/eventgrid';
import { type VideoIndexingCompletedEvent } from '@vidx/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createEventGridPublisher } from '../../src/adapters/event-grid-publisher.js';
import { type HttpStub, startHttpStub } from '../support/http-stub.js';

const event: VideoIndexingCompletedEvent = {
  id: 'evt-1',
  subject: 'videos/upl-0001',
  eventType: 'VideoIndexing.Completed',
  eventTime: '2026-08-12T10:00:00.000Z',
  dataVersion: '1',
  data: { videoId: 'vi-123', state: 'Processed', uploadId: 'upl-0001' },
};

describe('createEventGridPublisher (vs local endpoint stub)', () => {
  let stub: HttpStub;

  beforeAll(async () => {
    stub = await startHttpStub();
  });

  afterAll(async () => {
    await stub.close();
  });

  it('sends the event in the Event Grid event schema with the shared payload', async () => {
    const client = new EventGridPublisherClient(
      `${stub.baseUrl}/api/events`,
      'EventGrid',
      new AzureKeyCredential('stub-topic-key'),
      { allowInsecureConnection: true },
    );
    const publisher = createEventGridPublisher(client);

    await publisher.publishIndexingCompleted(event);

    const request = stub.requests.at(-1);
    expect(request?.method).toBe('POST');
    expect(request?.headers['aeg-sas-key']).toBe('stub-topic-key');
    const sent = JSON.parse(request?.body.toString('utf8') ?? '[]') as Record<string, unknown>[];
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      id: 'evt-1',
      subject: 'videos/upl-0001',
      eventType: 'VideoIndexing.Completed',
      dataVersion: '1',
      data: { videoId: 'vi-123', state: 'Processed', uploadId: 'upl-0001' },
    });
    expect(new Date(sent[0]?.eventTime as string).toISOString()).toBe('2026-08-12T10:00:00.000Z');
  });

  it('propagates publish failures', async () => {
    stub.respondWith(() => ({ status: 400, body: '{"error":"bad"}' }));
    const client = new EventGridPublisherClient(
      `${stub.baseUrl}/api/events`,
      'EventGrid',
      new AzureKeyCredential('stub-topic-key'),
      { allowInsecureConnection: true },
    );
    const publisher = createEventGridPublisher(client);

    await expect(publisher.publishIndexingCompleted(event)).rejects.toThrow();
  });
});
