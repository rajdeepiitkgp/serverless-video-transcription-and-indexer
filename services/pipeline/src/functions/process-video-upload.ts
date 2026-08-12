import { app, type EventGridEvent, type InvocationContext } from '@azure/functions';

import { pipelineDependencies } from '../app/composition-root.js';
import { processVideoUpload } from '../app/process-video-upload.js';
import { contextLogger } from './context-logger.js';

// Subscribed to the storage system topic, filtered to the videos container and
// PutBlob/PutBlockList (plan §2). Subscription wiring lands with infra phase 2 (M5).
app.eventGrid('ProcessVideoUpload', {
  handler: async (event: EventGridEvent, context: InvocationContext): Promise<void> => {
    await processVideoUpload(event, pipelineDependencies(contextLogger(context)));
  },
});
