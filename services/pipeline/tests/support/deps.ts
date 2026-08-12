import { type PipelineOptions } from '../../src/app/dependencies.js';
import {
  FakeDiagnosticsStore,
  FakeEventPublisher,
  FakeLogger,
  FakeMetadataRepository,
  FakeNotificationPublisher,
  FakeResultsStore,
  FakeUploadStore,
  FakeVideoIndexerClient,
  type FakeVideoIndexerContent,
  FixedClock,
  SequenceIdGenerator,
} from '../../src/testing/fakes.js';

export const TEST_NOW = new Date('2026-08-12T10:00:00.000Z');

/** A full dependency bag of fakes, typed concretely so tests can inspect recordings. */
export interface TestPipelineDependencies {
  metadata: FakeMetadataRepository;
  uploads: FakeUploadStore;
  results: FakeResultsStore;
  diagnostics: FakeDiagnosticsStore;
  videoIndexer: FakeVideoIndexerClient;
  events: FakeEventPublisher;
  notifications: FakeNotificationPublisher;
  logger: FakeLogger;
  clock: FixedClock;
  ids: SequenceIdGenerator;
  options: PipelineOptions;
}

export function testDependencies(
  viContent: FakeVideoIndexerContent = {},
): TestPipelineDependencies {
  return {
    metadata: new FakeMetadataRepository(),
    uploads: new FakeUploadStore(),
    results: new FakeResultsStore(),
    diagnostics: new FakeDiagnosticsStore(),
    videoIndexer: new FakeVideoIndexerClient(viContent),
    events: new FakeEventPublisher(),
    notifications: new FakeNotificationPublisher(),
    logger: new FakeLogger(),
    clock: new FixedClock(TEST_NOW),
    ids: new SequenceIdGenerator(),
    options: {
      videosContainer: 'videos',
      viCallbackUrl: 'https://pipeline.example.com/api/indexing-callback?code=function-key',
      watchBaseUrl: 'https://vidx.example.com',
      appInsightsUrl: 'https://portal.azure.com/#vidx-app-insights',
    },
  };
}
