import { randomUUID } from 'node:crypto';

import { createTrackingId, type VideoDocument } from '@vidx/shared';

import { type ReadSasPolicy } from '../core/sas-policy.js';
import { type Clock } from '../ports/clock.js';
import { type HealthProbes } from '../ports/health-probes.js';
import { type IdGenerator } from '../ports/ids.js';
import { type ResultsStore } from '../ports/results-store.js';
import { type ReadSasOptions, type VideoBlobStore } from '../ports/video-blob-store.js';
import { type VideoRepository } from '../ports/video-repository.js';

/*
 * In-memory adapters for the local dev host (plan §11: "Cosmos via emulator or dev
 * doc-store fake"). Same ports the real Azure adapters implement; "SAS" URLs point
 * back at the dev host's /devblob endpoints, which accept the browser's PUT and
 * serve playback with range support.
 */

export class DevVideoRepository implements VideoRepository {
  private readonly documents = new Map<string, VideoDocument>();
  private sequence = 0;
  private readonly order = new Map<string, number>();

  upsert(document: VideoDocument): void {
    if (!this.order.has(document.id)) {
      this.sequence += 1;
      this.order.set(document.id, this.sequence);
    }
    this.documents.set(document.id, document);
  }

  get(uploadId: string): Promise<VideoDocument | null> {
    return Promise.resolve(this.documents.get(uploadId) ?? null);
  }

  list(): Promise<VideoDocument[]> {
    const all = [...this.documents.values()].sort(
      (a, b) => (this.order.get(b.id) ?? 0) - (this.order.get(a.id) ?? 0),
    );
    return Promise.resolve(all);
  }

  create(document: VideoDocument): Promise<void> {
    this.upsert(document);
    return Promise.resolve();
  }

  delete(uploadId: string): Promise<void> {
    this.documents.delete(uploadId);
    this.order.delete(uploadId);
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

export interface StoredBlob {
  bytes: Buffer;
  contentType: string;
}

export class DevVideoBlobStore implements VideoBlobStore {
  readonly blobs = new Map<string, StoredBlob>();

  constructor(private readonly baseUrl: string) {}

  // Fewer parameters than the port is fine — dev URLs need no SAS window.
  createUploadSasUrl(blobName: string): Promise<string> {
    return Promise.resolve(`${this.baseUrl}/devblob/videos/${encodeURI(blobName)}?sig=dev-write`);
  }

  createReadSasUrl(
    blobName: string,
    policy: ReadSasPolicy,
    options?: ReadSasOptions,
  ): Promise<string> {
    const disposition =
      options?.contentDisposition === undefined
        ? ''
        : `&rscd=${encodeURIComponent(options.contentDisposition)}`;
    return Promise.resolve(
      `${this.baseUrl}/devblob/videos/${encodeURI(blobName)}?sig=dev-read${disposition}`,
    );
  }

  delete(blobName: string): Promise<void> {
    this.blobs.delete(blobName);
    return Promise.resolve();
  }
}

/** Results artifacts (captions VTT) as UTF-8 strings, served from /devblob/results. */
export class DevResultsStore implements ResultsStore {
  readonly blobs = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  read(blobName: string): Promise<string | null> {
    return Promise.resolve(this.blobs.get(blobName) ?? null);
  }

  createReadSasUrl(blobName: string): Promise<string> {
    return Promise.resolve(`${this.baseUrl}/devblob/results/${encodeURI(blobName)}?sig=dev-read`);
  }

  deletePrefix(prefix: string): Promise<void> {
    for (const key of [...this.blobs.keys()]) {
      if (key.startsWith(prefix)) {
        this.blobs.delete(key);
      }
    }
    return Promise.resolve();
  }
}

export const devHealthProbes: HealthProbes = {
  cosmos: () => Promise.resolve(),
  storage: () => Promise.resolve(),
};

export const devClock: Clock = { now: () => new Date() };

export const devIds: IdGenerator = {
  uploadId: () => randomUUID(),
  trackingId: createTrackingId,
};
