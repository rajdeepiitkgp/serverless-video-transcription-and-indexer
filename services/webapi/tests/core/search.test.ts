import { describe, expect, it } from 'vitest';

import { MAX_TRANSCRIPT_MATCHES_PER_VIDEO, searchVideos } from '../../src/core/search.js';
import { processedVideoDocument, videoDocument } from '../support/builders.js';

describe('searchVideos', () => {
  it('matches across name, keywords, topics, and transcript lines', () => {
    const document = processedVideoDocument({
      name: 'azure-demo.mp4',
      keywords: ['azure functions'],
      topics: ['Azure cloud'],
      transcript: [
        { text: 'Welcome to Azure.', startSeconds: 1, endSeconds: 2 },
        { text: 'Nothing here.', startSeconds: 2, endSeconds: 3 },
      ],
    });

    expect(searchVideos([document], 'azure')).toEqual([
      {
        id: document.id,
        name: 'azure-demo.mp4',
        status: 'Processed',
        matches: [
          { field: 'name', snippet: 'azure-demo.mp4' },
          { field: 'keyword', snippet: 'azure functions' },
          { field: 'topic', snippet: 'Azure cloud' },
          { field: 'transcript', snippet: 'Welcome to Azure.', startSeconds: 1 },
        ],
      },
    ]);
  });

  it('is case-insensitive in both directions', () => {
    const document = processedVideoDocument({ keywords: ['Transcription'] });
    const [result] = searchVideos([document], 'tranSCRIP');
    expect(result?.matches.some((match) => match.field === 'keyword')).toBe(true);
  });

  it('omits documents without a match', () => {
    expect(searchVideos([videoDocument({ name: 'cats.mp4' })], 'dogs')).toEqual([]);
  });

  it('returns nothing for a blank term', () => {
    expect(searchVideos([processedVideoDocument()], '   ')).toEqual([]);
  });

  it(`caps transcript matches at ${String(MAX_TRANSCRIPT_MATCHES_PER_VIDEO)} per video`, () => {
    const lines = Array.from({ length: 20 }, (_, index) => ({
      text: `azure line ${String(index)}`,
      startSeconds: index,
      endSeconds: index + 1,
    }));
    const document = processedVideoDocument({ name: 'other.mp4', transcript: lines });

    const [result] = searchVideos([document], 'azure line');

    expect(result?.matches).toHaveLength(MAX_TRANSCRIPT_MATCHES_PER_VIDEO);
    expect(result?.matches[0]).toEqual({
      field: 'transcript',
      snippet: 'azure line 0',
      startSeconds: 0,
    });
  });

  it('searches Uploaded documents too (name matches before insights exist)', () => {
    const document = videoDocument({ name: 'quarterly-review.mp4' });
    expect(searchVideos([document], 'quarterly')).toHaveLength(1);
  });
});
