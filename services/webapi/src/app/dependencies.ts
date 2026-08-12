import { type Clock } from '../ports/clock.js';
import { type HealthProbes } from '../ports/health-probes.js';
import { type IdGenerator } from '../ports/ids.js';
import { type Logger } from '../ports/logger.js';
import { type ResultsStore } from '../ports/results-store.js';
import { type VideoBlobStore } from '../ports/video-blob-store.js';
import { type VideoRepository } from '../ports/video-repository.js';

export interface WebApiOptions {
  /** Container names appear inside stored `blobPath`/`resultsPrefix` values (plan §5). */
  videosContainer: string;
  resultsContainer: string;
  /** A dependency probe slower than this reports `down` (plan §4 health checks). */
  healthProbeTimeoutMs: number;
}

/** Everything the handlers touch, injected by the composition root or by tests. */
export interface WebApiDependencies {
  videos: VideoRepository;
  videoBlobs: VideoBlobStore;
  results: ResultsStore;
  probes: HealthProbes;
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
  options: WebApiOptions;
}
