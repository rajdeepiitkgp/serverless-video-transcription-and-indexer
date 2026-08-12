import { type Clock } from '../ports/clock.js';
import { type DiagnosticsStore } from '../ports/diagnostics-store.js';
import { type EventPublisher } from '../ports/event-publisher.js';
import { type IdGenerator } from '../ports/ids.js';
import { type Logger } from '../ports/logger.js';
import { type MetadataRepository } from '../ports/metadata-repository.js';
import { type NotificationPublisher } from '../ports/notification-publisher.js';
import { type ResultsStore } from '../ports/results-store.js';
import { type UploadStore } from '../ports/upload-store.js';
import { type VideoIndexerClient } from '../ports/video-indexer-client.js';

export interface PipelineOptions {
  videosContainer: string;
  /** IndexingCallback function URL (with function key); `uploadId` is appended per video. */
  viCallbackUrl: string;
  /** SWA origin for watch-page links in notifications; absent until M5 wiring. */
  watchBaseUrl?: string | undefined;
  /** Portal deep link for failure embeds (plan §4); absent until M5 wiring. */
  appInsightsUrl?: string | undefined;
}

/** Everything the use-cases touch, injected by the composition root or by tests/replay. */
export interface PipelineDependencies {
  metadata: MetadataRepository;
  uploads: UploadStore;
  results: ResultsStore;
  diagnostics: DiagnosticsStore;
  videoIndexer: VideoIndexerClient;
  events: EventPublisher;
  notifications: NotificationPublisher;
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
  options: PipelineOptions;
}
