import { type WebApiOptions } from '../../src/app/dependencies.js';
import {
  FakeHealthProbes,
  FakeLogger,
  FakeResultsStore,
  FakeVideoBlobStore,
  FakeVideoRepository,
  FixedClock,
  SequenceIdGenerator,
} from './fakes.js';

export const TEST_NOW = new Date('2026-08-12T10:00:00.000Z');

/** A full dependency bag of fakes, typed concretely so tests can inspect recordings. */
export interface TestWebApiDependencies {
  videos: FakeVideoRepository;
  videoBlobs: FakeVideoBlobStore;
  results: FakeResultsStore;
  probes: FakeHealthProbes;
  logger: FakeLogger;
  clock: FixedClock;
  ids: SequenceIdGenerator;
  options: WebApiOptions;
}

export function testDependencies(): TestWebApiDependencies {
  return {
    videos: new FakeVideoRepository(),
    videoBlobs: new FakeVideoBlobStore(),
    results: new FakeResultsStore(),
    probes: new FakeHealthProbes(),
    logger: new FakeLogger(),
    clock: new FixedClock(TEST_NOW),
    ids: new SequenceIdGenerator(),
    options: {
      videosContainer: 'videos',
      resultsContainer: 'results',
      healthProbeTimeoutMs: 25,
    },
  };
}
