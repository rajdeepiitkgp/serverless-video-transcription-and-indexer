import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions';

import { pipelineDependencies } from '../app/composition-root.js';
import { handleIndexingCallback } from '../app/handle-indexing-callback.js';
import { contextLogger } from './context-logger.js';

// Function-key auth: the URL (with key) is known only to Video Indexer (plan §2).
app.http('IndexingCallback', {
  methods: ['GET', 'POST'],
  authLevel: 'function',
  route: 'indexing-callback',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const result = await handleIndexingCallback(
      Object.fromEntries(request.query),
      pipelineDependencies(contextLogger(context)),
    );
    return { status: result.status, body: result.body };
  },
});
