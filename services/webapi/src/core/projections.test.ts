import { describe, expect, it } from 'vitest';

import { processedVideoDocument, videoDocument } from '../../test-support/builders.js';
import { toTranscriptResponse, toVideoDetail, toVideoSummary } from './projections.js';

describe('toVideoSummary', () => {
  it('projects the list fields (plan §4: status, name, duration, uploader, playable)', () => {
    const summary = toVideoSummary(processedVideoDocument());

    expect(summary).toEqual({
      id: 'upl-0001',
      name: 'demo.mp4',
      status: 'Processed',
      playable: true,
      uploadedBy: { userId: 'user-1', userDetails: 'user@example.com' },
      durationInSeconds: 62,
      thumbnailId: 'thumb-1',
      submittedAt: '2026-08-12T09:00:00.000Z',
      processedAt: '2026-08-12T09:10:00.000Z',
    });
  });

  it('never leaks blobPath, trackingIds, or the transcript into the list', () => {
    const summary = toVideoSummary(processedVideoDocument());

    expect(summary).not.toHaveProperty('blobPath');
    expect(summary).not.toHaveProperty('trackingIds');
    expect(summary).not.toHaveProperty('transcript');
  });

  it('handles a fresh Uploaded document with no insight fields', () => {
    const summary = toVideoSummary(videoDocument());

    expect(summary.status).toBe('Uploaded');
    expect(summary.durationInSeconds).toBeUndefined();
  });
});

describe('toVideoDetail', () => {
  it('adds insights and the issued URLs', () => {
    const detail = toVideoDetail(processedVideoDocument(), {
      playbackUrl: 'https://storage.example.com/videos/upl-0001/demo.mp4?sas',
      captionsUrl: 'https://storage.example.com/results/upl-0001/transcript.vtt?sas',
    });

    expect(detail.keywords).toEqual(['transcription', 'azure']);
    expect(detail.topics).toEqual(['Cloud computing']);
    expect(detail.chapters).toEqual([{ title: 'Intro', startSeconds: 0, endSeconds: 30 }]);
    expect(detail.playbackUrl).toContain('demo.mp4');
    expect(detail.captionsUrl).toContain('transcript.vtt');
    expect(detail.error).toBeNull();
  });

  it('keeps the URLs null for an unprocessed video', () => {
    const detail = toVideoDetail(videoDocument(), { playbackUrl: null, captionsUrl: null });

    expect(detail.playbackUrl).toBeNull();
    expect(detail.captionsUrl).toBeNull();
  });
});

describe('toTranscriptResponse', () => {
  it('returns the timestamped lines', () => {
    expect(toTranscriptResponse(processedVideoDocument())).toEqual({
      id: 'upl-0001',
      name: 'demo.mp4',
      lines: [
        { text: 'Welcome to the demo.', startSeconds: 1.2, endSeconds: 4.5 },
        { text: 'Uploading a video is easy.', startSeconds: 4.5, endSeconds: 9 },
      ],
    });
  });
});
