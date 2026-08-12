import { app, type EventGridEvent, type InvocationContext } from '@azure/functions';

import { pipelineDependencies } from '../app/composition-root.js';
import { processVideoResults } from '../app/process-video-results.js';
import { contextLogger } from './context-logger.js';

// Subscribed to the custom topic's VideoIndexing.Completed events (plan §2 flow note 5).
app.eventGrid('ProcessVideoResults', {
  handler: async (event: EventGridEvent, context: InvocationContext): Promise<void> => {
    await processVideoResults(event, pipelineDependencies(contextLogger(context)));
  },
});
