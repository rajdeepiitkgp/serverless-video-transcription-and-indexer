import {
  type TrackingId,
  type VideoDocument,
  type VideoIndexingCompletedEvent,
} from '@vidx/shared';

import { type VideoNotification } from '../core/notification.js';
import { type ReadSasPolicy } from '../core/sas-policy.js';
import { type Clock } from '../ports/clock.js';
import { type DiagnosticsStore } from '../ports/diagnostics-store.js';
import { type EventPublisher } from '../ports/event-publisher.js';
import { type IdGenerator } from '../ports/ids.js';
import { type Logger, type LogProperties } from '../ports/logger.js';
import { type MetadataRepository } from '../ports/metadata-repository.js';
import { type NotificationPublisher } from '../ports/notification-publisher.js';
import { type ResultsStore } from '../ports/results-store.js';
import { type UploadStore } from '../ports/upload-store.js';
import {
  type SubmittedVideo,
  type SubmitVideoRequest,
  type VideoIndexerClient,
} from '../ports/video-indexer-client.js';

/**
 * In-memory fakes implementing every port (docs/testing-principles.md §2). They back
 * the handler tests *and* the replay harness (plan §7), so they live in src/ and ship
 * with the build. Each fake records what it was asked to do and can be armed with an
 * `*Error` to simulate the dependency failing.
 */

export class FakeMetadataRepository implements MetadataRepository {
  readonly documents = new Map<string, VideoDocument>();
  upsertError: Error | null = null;

  seed(document: VideoDocument): void {
    this.documents.set(document.id, document);
  }

  get(uploadId: string): Promise<VideoDocument | null> {
    return Promise.resolve(this.documents.get(uploadId) ?? null);
  }

  findByVideoId(videoId: string): Promise<VideoDocument | null> {
    for (const document of this.documents.values()) {
      if (document.videoId === videoId) return Promise.resolve(document);
    }
    return Promise.resolve(null);
  }

  upsert(document: VideoDocument): Promise<void> {
    if (this.upsertError !== null) return Promise.reject(this.upsertError);
    this.documents.set(document.id, document);
    return Promise.resolve();
  }
}

export class FakeUploadStore implements UploadStore {
  readonly requests: { blobName: string; policy: ReadSasPolicy }[] = [];

  createReadSasUrl(blobName: string, policy: ReadSasPolicy): Promise<string> {
    this.requests.push({ blobName, policy });
    return Promise.resolve(
      `https://fake.blob.core.windows.net/videos/${blobName}?sig=fake-signature`,
    );
  }
}

export interface StoredBlob {
  body: string | Uint8Array;
  contentType: string;
}

export class FakeResultsStore implements ResultsStore {
  readonly blobs = new Map<string, StoredBlob>();

  write(blobName: string, body: string | Uint8Array, contentType: string): Promise<void> {
    this.blobs.set(blobName, { body, contentType });
    return Promise.resolve();
  }
}

export class FakeDiagnosticsStore implements DiagnosticsStore {
  /** Keyed `{uploadId}/{entryName}`. */
  readonly entries = new Map<string, StoredBlob>();
  writeError: Error | null = null;

  write(
    uploadId: string,
    entryName: string,
    body: string | Uint8Array,
    contentType: string,
  ): Promise<void> {
    if (this.writeError !== null) return Promise.reject(this.writeError);
    this.entries.set(`${uploadId}/${entryName}`, { body, contentType });
    return Promise.resolve();
  }
}

export interface FakeVideoIndexerContent {
  index?: unknown;
  captions?: string;
  thumbnails?: Record<string, Uint8Array>;
}

/** Serves canned VI responses — in tests from literals, in replay from a bundle (plan §7). */
export class FakeVideoIndexerClient implements VideoIndexerClient {
  readonly submissions: SubmitVideoRequest[] = [];
  submitResult: SubmittedVideo = { videoId: 'vi-fake-1', state: 'Uploaded' };
  submitError: Error | null = null;
  indexError: Error | null = null;
  captionsError: Error | null = null;
  thumbnailError: Error | null = null;

  private readonly content: FakeVideoIndexerContent;

  constructor(content: FakeVideoIndexerContent = {}) {
    this.content = content;
  }

  submitVideo(request: SubmitVideoRequest): Promise<SubmittedVideo> {
    if (this.submitError !== null) return Promise.reject(this.submitError);
    this.submissions.push(request);
    return Promise.resolve(this.submitResult);
  }

  getIndex(videoId: string): Promise<unknown> {
    if (this.indexError !== null) return Promise.reject(this.indexError);
    if (this.content.index === undefined) {
      return Promise.reject(new Error(`No canned index for video ${videoId}`));
    }
    return Promise.resolve(this.content.index);
  }

  getCaptions(videoId: string): Promise<string> {
    if (this.captionsError !== null) return Promise.reject(this.captionsError);
    if (this.content.captions === undefined) {
      return Promise.reject(new Error(`No canned captions for video ${videoId}`));
    }
    return Promise.resolve(this.content.captions);
  }

  getThumbnail(videoId: string, thumbnailId: string): Promise<Uint8Array> {
    if (this.thumbnailError !== null) return Promise.reject(this.thumbnailError);
    const thumbnail = this.content.thumbnails?.[thumbnailId];
    if (thumbnail === undefined) {
      return Promise.reject(new Error(`No canned thumbnail ${thumbnailId} for video ${videoId}`));
    }
    return Promise.resolve(thumbnail);
  }
}

export class FakeEventPublisher implements EventPublisher {
  readonly published: VideoIndexingCompletedEvent[] = [];
  publishError: Error | null = null;

  publishIndexingCompleted(event: VideoIndexingCompletedEvent): Promise<void> {
    if (this.publishError !== null) return Promise.reject(this.publishError);
    this.published.push(event);
    return Promise.resolve();
  }
}

export class FakeNotificationPublisher implements NotificationPublisher {
  readonly notifications: VideoNotification[] = [];
  publishError: Error | null = null;

  publish(notification: VideoNotification): Promise<void> {
    if (this.publishError !== null) return Promise.reject(this.publishError);
    this.notifications.push(notification);
    return Promise.resolve();
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

/** Deterministic ids: evt-1, evt-2, … and VXT-00000001, VXT-00000002, … */
export class SequenceIdGenerator implements IdGenerator {
  private events = 0;
  private trackings = 0;

  eventId(): string {
    this.events += 1;
    return `evt-${String(this.events)}`;
  }

  trackingId(): TrackingId {
    this.trackings += 1;
    return `VXT-${String(this.trackings).padStart(8, '0')}`;
  }
}
