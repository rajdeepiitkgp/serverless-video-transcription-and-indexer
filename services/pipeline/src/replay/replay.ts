import {
  VIDEO_INDEXING_COMPLETED_EVENT_TYPE,
  type VideoDocument,
  videoDocumentSchema,
} from '@vidx/shared';

import { processVideoResults } from '../app/process-video-results.js';
import { type VideoNotification } from '../core/notification.js';
import {
  FakeDiagnosticsStore,
  FakeEventPublisher,
  FakeLogger,
  FakeMetadataRepository,
  FakeNotificationPublisher,
  FakeResultsStore,
  FakeUploadStore,
  FakeVideoIndexerClient,
  FixedClock,
  type LogEntry,
  SequenceIdGenerator,
  type StoredBlob,
} from '../testing/fakes.js';
import { type ReplayBundle } from './bundle.js';

export interface ReplayResult {
  document: VideoDocument | null;
  notifications: VideoNotification[];
  resultsBlobs: Map<string, StoredBlob>;
  diagnosticsEntries: string[];
  logs: LogEntry[];
}

/**
 * Re-runs the real `ProcessVideoResults` core logic with bundle-backed fakes —
 * the exact production execution under a local debugger, no Azure access (plan §7).
 * The bundled document is rewound to `Indexing` first: a downloaded bundle carries
 * the terminal document, and replaying is about reproducing how it got there.
 */
export async function replayProcessResults(
  bundle: ReplayBundle,
  replayedAt: Date,
): Promise<ReplayResult> {
  const rewound = { ...bundle.document };
  delete rewound.processedAt;
  const document = videoDocumentSchema.parse({ ...rewound, status: 'Indexing', error: null });

  const videoId = bundle.event?.data.videoId ?? document.videoId;
  if (videoId === null) {
    throw new Error('Bundle document has no videoId — the video never reached Video Indexer');
  }

  const indexState = (bundle.viIndex as { state?: string }).state;
  // The use-case re-validates the event at its boundary, exactly as in production.
  const event: unknown = bundle.event ?? {
    id: 'replay-synthesized-event',
    subject: `videos/${document.id}`,
    eventType: VIDEO_INDEXING_COMPLETED_EVENT_TYPE,
    eventTime: replayedAt.toISOString(),
    dataVersion: '1',
    data: {
      videoId,
      state: indexState === 'Failed' ? 'Failed' : 'Processed',
      uploadId: document.id,
    },
  };

  const metadata = new FakeMetadataRepository();
  metadata.seed(document);
  const results = new FakeResultsStore();
  const diagnostics = new FakeDiagnosticsStore();
  const notifications = new FakeNotificationPublisher();
  const logger = new FakeLogger();

  await processVideoResults(event, {
    metadata,
    uploads: new FakeUploadStore(),
    results,
    diagnostics,
    videoIndexer: new FakeVideoIndexerClient({
      index: bundle.viIndex,
      ...(bundle.viCaptions === null ? {} : { captions: bundle.viCaptions }),
    }),
    events: new FakeEventPublisher(),
    notifications,
    logger,
    clock: new FixedClock(replayedAt),
    ids: new SequenceIdGenerator(),
    options: {
      videosContainer: 'videos',
      viCallbackUrl: 'https://replay.invalid/api/indexing-callback',
    },
  });

  return {
    document: metadata.documents.get(document.id) ?? null,
    notifications: notifications.notifications,
    resultsBlobs: results.blobs,
    diagnosticsEntries: [...diagnostics.entries.keys()],
    logs: logger.entries,
  };
}
