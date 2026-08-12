import { type TrackingId, type VideoDocument } from '@vidx/shared';

import { type ReadSasPolicy, type WriteSasPolicy } from '../../src/core/sas-policy.js';
import { type Clock } from '../../src/ports/clock.js';
import { type HealthProbes } from '../../src/ports/health-probes.js';
import { type IdGenerator } from '../../src/ports/ids.js';
import { type Logger, type LogProperties } from '../../src/ports/logger.js';
import { type ResultsStore } from '../../src/ports/results-store.js';
import { type ReadSasOptions, type VideoBlobStore } from '../../src/ports/video-blob-store.js';
import { type VideoRepository } from '../../src/ports/video-repository.js';

/**
 * In-memory fakes implementing every port (docs/testing-principles.md §2). Each fake
 * records what it was asked to do and can be armed with an `*Error` to simulate the
 * dependency failing.
 */

export class FakeVideoRepository implements VideoRepository {
  readonly documents = new Map<string, VideoDocument>();
  createError: Error | null = null;
  deleteError: Error | null = null;
  listError: Error | null = null;

  private writeSequence = 0;
  private readonly writeOrder = new Map<string, number>();

  seed(document: VideoDocument): void {
    this.writeSequence += 1;
    this.writeOrder.set(document.id, this.writeSequence);
    this.documents.set(document.id, document);
  }

  get(uploadId: string): Promise<VideoDocument | null> {
    return Promise.resolve(this.documents.get(uploadId) ?? null);
  }

  list(): Promise<VideoDocument[]> {
    if (this.listError !== null) return Promise.reject(this.listError);
    const documents = [...this.documents.values()].sort(
      (a, b) => (this.writeOrder.get(b.id) ?? 0) - (this.writeOrder.get(a.id) ?? 0),
    );
    return Promise.resolve(documents);
  }

  create(document: VideoDocument): Promise<void> {
    if (this.createError !== null) return Promise.reject(this.createError);
    this.seed(document);
    return Promise.resolve();
  }

  delete(uploadId: string): Promise<void> {
    if (this.deleteError !== null) return Promise.reject(this.deleteError);
    this.documents.delete(uploadId);
    return Promise.resolve();
  }

  async search(term: string): Promise<VideoDocument[]> {
    const lower = term.toLowerCase();
    const inText = (text: string): boolean => text.toLowerCase().includes(lower);
    return (await this.list()).filter(
      (document) =>
        inText(document.name) ||
        document.keywords.some(inText) ||
        document.topics.some(inText) ||
        document.transcript.some((line) => inText(line.text)),
    );
  }
}

export interface SasRequest {
  blobName: string;
  policy: WriteSasPolicy | ReadSasPolicy;
  options?: ReadSasOptions | undefined;
}

export class FakeVideoBlobStore implements VideoBlobStore {
  readonly uploadSasRequests: SasRequest[] = [];
  readonly readSasRequests: SasRequest[] = [];
  readonly deleted: string[] = [];
  sasError: Error | null = null;
  deleteError: Error | null = null;

  createUploadSasUrl(blobName: string, policy: WriteSasPolicy): Promise<string> {
    if (this.sasError !== null) return Promise.reject(this.sasError);
    this.uploadSasRequests.push({ blobName, policy });
    return Promise.resolve(
      `https://fake.blob.core.windows.net/videos/${blobName}?sig=fake-write-sas`,
    );
  }

  createReadSasUrl(
    blobName: string,
    policy: ReadSasPolicy,
    options?: ReadSasOptions,
  ): Promise<string> {
    if (this.sasError !== null) return Promise.reject(this.sasError);
    this.readSasRequests.push({ blobName, policy, options });
    return Promise.resolve(
      `https://fake.blob.core.windows.net/videos/${blobName}?sig=fake-read-sas`,
    );
  }

  delete(blobName: string): Promise<void> {
    if (this.deleteError !== null) return Promise.reject(this.deleteError);
    this.deleted.push(blobName);
    return Promise.resolve();
  }
}

export class FakeResultsStore implements ResultsStore {
  /** Keyed by container-relative blob name, e.g. `upl-1/transcript.vtt`. */
  readonly blobs = new Map<string, string>();
  readonly readSasRequests: SasRequest[] = [];
  readonly deletedPrefixes: string[] = [];
  readError: Error | null = null;

  read(blobName: string): Promise<string | null> {
    if (this.readError !== null) return Promise.reject(this.readError);
    return Promise.resolve(this.blobs.get(blobName) ?? null);
  }

  createReadSasUrl(blobName: string, policy: ReadSasPolicy): Promise<string> {
    this.readSasRequests.push({ blobName, policy });
    return Promise.resolve(
      `https://fake.blob.core.windows.net/results/${blobName}?sig=fake-read-sas`,
    );
  }

  deletePrefix(prefix: string): Promise<void> {
    this.deletedPrefixes.push(prefix);
    for (const key of [...this.blobs.keys()]) {
      if (key.startsWith(prefix)) this.blobs.delete(key);
    }
    return Promise.resolve();
  }
}

export class FakeHealthProbes implements HealthProbes {
  cosmosError: Error | null = null;
  storageError: Error | null = null;
  /** Armed probes never settle — exercises the health-check timeout. */
  cosmosHangs = false;
  storageHangs = false;

  cosmos(): Promise<void> {
    if (this.cosmosHangs) return new Promise(() => undefined);
    return this.cosmosError === null ? Promise.resolve() : Promise.reject(this.cosmosError);
  }

  storage(): Promise<void> {
    if (this.storageHangs) return new Promise(() => undefined);
    return this.storageError === null ? Promise.resolve() : Promise.reject(this.storageError);
  }
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  properties?: LogProperties | undefined;
}

export class FakeLogger implements Logger {
  readonly entries: LogEntry[] = [];

  info(message: string, properties?: LogProperties): void {
    this.entries.push({ level: 'info', message, properties });
  }

  warn(message: string, properties?: LogProperties): void {
    this.entries.push({ level: 'warn', message, properties });
  }

  error(message: string, properties?: LogProperties): void {
    this.entries.push({ level: 'error', message, properties });
  }

  messages(level: LogEntry['level']): string[] {
    return this.entries.filter((entry) => entry.level === level).map((entry) => entry.message);
  }
}

export class FixedClock implements Clock {
  constructor(private readonly current: Date) {}

  now(): Date {
    return new Date(this.current.getTime());
  }
}

/** Deterministic ids: upl-0001, upl-0002, … and VXT-00000001, VXT-00000002, … */
export class SequenceIdGenerator implements IdGenerator {
  private uploads = 0;
  private trackings = 0;

  uploadId(): string {
    this.uploads += 1;
    return `upl-${String(this.uploads).padStart(4, '0')}`;
  }

  trackingId(): TrackingId {
    this.trackings += 1;
    return `VXT-${String(this.trackings).padStart(8, '0')}`;
  }
}
