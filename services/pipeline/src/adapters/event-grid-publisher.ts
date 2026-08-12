import { type EventGridPublisherClient } from '@azure/eventgrid';
import { type VideoIndexingCompletedEvent } from '@vidx/shared';

import { type EventPublisher } from '../ports/event-publisher.js';

/**
 * Publishes to the custom topic using the Event Grid *event schema* (matching the
 * shared envelope — not CloudEvents). Production auth is the pipeline app's managed
 * identity (EventGrid Data Sender, plan §5).
 */
export function createEventGridPublisher(
  client: EventGridPublisherClient<'EventGrid'>,
): EventPublisher {
  return {
    async publishIndexingCompleted(event: VideoIndexingCompletedEvent): Promise<void> {
      await client.send([
        {
          id: event.id,
          subject: event.subject,
          eventType: event.eventType,
          eventTime: new Date(event.eventTime),
          dataVersion: event.dataVersion ?? '1',
          data: event.data,
        },
      ]);
    },
  };
}
