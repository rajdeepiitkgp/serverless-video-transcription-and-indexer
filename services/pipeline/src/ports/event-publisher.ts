import { type VideoIndexingCompletedEvent } from '@vidx/shared';

/** The custom Event Grid topic (plan §2 flow note 4: callback republishes, never trusts). */
export interface EventPublisher {
  publishIndexingCompleted(event: VideoIndexingCompletedEvent): Promise<void>;
}
