import { type TranscriptLine, type VideoDetail } from '@vidx/shared';

/** A fully-processed, browser-playable video — override per test case. */
export function buildVideoDetail(overrides: Partial<VideoDetail> = {}): VideoDetail {
  return {
    id: 'vid-1',
    name: 'launch-briefing.mp4',
    status: 'Processed',
    playable: true,
    uploadedBy: { userId: 'user-1', userDetails: 'ana@example.com' },
    durationInSeconds: 252,
    thumbnailId: null,
    submittedAt: '2026-08-01T10:00:00Z',
    keywords: ['launch', 'roadmap'],
    topics: ['Product planning'],
    chapters: [
      { title: 'Introductions', startSeconds: 0, endSeconds: 60 },
      { title: 'The launch date', startSeconds: 60, endSeconds: 252 },
    ],
    playbackUrl: 'https://storage.example.com/videos/vid-1.mp4?sas=abc',
    captionsUrl: 'https://storage.example.com/results/vid-1/transcript.vtt?sas=abc',
    error: null,
    ...overrides,
  };
}

export function buildTranscriptLines(): TranscriptLine[] {
  return [
    { text: 'Welcome, everyone.', startSeconds: 0, endSeconds: 4 },
    { text: 'Now, the part everyone came for: the launch date.', startSeconds: 4, endSeconds: 9 },
    { text: "We're locking it to the second week of October.", startSeconds: 9, endSeconds: 14 },
  ];
}
