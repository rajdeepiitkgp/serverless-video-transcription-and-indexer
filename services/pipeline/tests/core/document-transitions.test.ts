import { type VideoInsights } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import { markFailed, markIndexing, markProcessed } from '../../src/core/document-transitions.js';
import { videoDocument } from '../support/builders.js';

const insights: VideoInsights = {
  durationInSeconds: 127.04,
  transcript: [{ text: 'Welcome to the product demo.', startSeconds: 1.2, endSeconds: 4.5 }],
  keywords: ['product demo'],
  topics: ['Cloud Computing'],
  chapters: [{ title: 'Cloud Computing', startSeconds: 0, endSeconds: 60 }],
  thumbnailId: 'thumb-1',
  failure: null,
};

describe('markIndexing', () => {
  it('attaches the VI video id and stamps submittedAt', () => {
    const submitted = markIndexing(videoDocument(), 'vi-123', new Date('2026-08-12T10:00:00Z'));
    expect(submitted.status).toBe('Indexing');
    expect(submitted.videoId).toBe('vi-123');
    expect(submitted.submittedAt).toBe('2026-08-12T10:00:00.000Z');
    expect(submitted.error).toBeNull();
  });

  it('refuses to re-submit a document that already left Uploaded', () => {
    const processed = videoDocument({ status: 'Indexing', videoId: 'vi-123' });
    expect(() => markIndexing(processed, 'vi-456', new Date())).toThrow(
      'Invalid status transition',
    );
  });
});

describe('markProcessed', () => {
  const indexing = videoDocument({ status: 'Indexing', videoId: 'vi-123' });

  it('copies every insight field onto the document', () => {
    const processed = markProcessed(
      indexing,
      insights,
      new Date('2026-08-12T11:00:00Z'),
      'VXT-22222222',
    );
    expect(processed.status).toBe('Processed');
    expect(processed.durationInSeconds).toBe(127.04);
    expect(processed.transcript).toEqual(insights.transcript);
    expect(processed.keywords).toEqual(['product demo']);
    expect(processed.topics).toEqual(['Cloud Computing']);
    expect(processed.chapters).toEqual(insights.chapters);
    expect(processed.thumbnailId).toBe('thumb-1');
    expect(processed.processedAt).toBe('2026-08-12T11:00:00.000Z');
    expect(processed.error).toBeNull();
  });

  it('records the results tracking id alongside the upload one', () => {
    const processed = markProcessed(indexing, insights, new Date(), 'VXT-22222222');
    expect(processed.trackingIds).toEqual({ upload: 'VXT-11111111', results: 'VXT-22222222' });
  });

  it('refuses to process a document that was never submitted', () => {
    expect(() => markProcessed(videoDocument(), insights, new Date(), 'VXT-22222222')).toThrow(
      'Invalid status transition',
    );
  });
});

describe('markFailed', () => {
  it('fails a document from Uploaded (submission stage)', () => {
    const failed = markFailed(videoDocument(), 'VI rejected it', new Date('2026-08-12T10:05:00Z'));
    expect(failed.status).toBe('Failed');
    expect(failed.error).toBe('VI rejected it');
    expect(failed.processedAt).toBe('2026-08-12T10:05:00.000Z');
    expect(failed.trackingIds).toEqual({ upload: 'VXT-11111111' });
  });

  it('fails a document from Indexing with a results tracking id', () => {
    const indexing = videoDocument({ status: 'Indexing', videoId: 'vi-123' });
    const failed = markFailed(indexing, 'UnsupportedFileType', new Date(), 'VXT-33333333');
    expect(failed.status).toBe('Failed');
    expect(failed.trackingIds).toEqual({ upload: 'VXT-11111111', results: 'VXT-33333333' });
  });

  it('refuses to fail an already-terminal document', () => {
    const done = videoDocument({ status: 'Processed', videoId: 'vi-123' });
    expect(() => markFailed(done, 'boom', new Date())).toThrow('Invalid status transition');
  });
});
