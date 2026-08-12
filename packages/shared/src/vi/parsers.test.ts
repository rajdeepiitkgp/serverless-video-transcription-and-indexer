import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  extractInsights,
  parseChapters,
  parseDuration,
  parseFailure,
  parseKeywords,
  parseThumbnailId,
  parseTopics,
  parseTranscript,
} from './parsers.js';
import { parseViIndex, type ViIndex } from './vi-index.js';

function loadFixture(name: string): ViIndex {
  const url = new URL(`../../fixtures/${name}.json`, import.meta.url);
  return parseViIndex(JSON.parse(readFileSync(url, 'utf8')));
}

const processed = loadFixture('vi-index-processed');
const minimal = loadFixture('vi-index-minimal');
const failed = loadFixture('vi-index-failed');

describe('parseViIndex', () => {
  it('accepts real VI index payloads', () => {
    expect(processed.state).toBe('Processed');
    expect(processed.videos).toHaveLength(1);
    expect(failed.state).toBe('Failed');
  });

  it('rejects payloads that are not a VI index', () => {
    expect(() => parseViIndex({})).toThrow();
    expect(() => parseViIndex(42)).toThrow();
    expect(() => parseViIndex({ state: 'Processed', videos: 'nope' })).toThrow();
  });
});

describe('parseTranscript', () => {
  it('extracts ordered timestamped lines from a processed index', () => {
    const lines = parseTranscript(processed);

    const expected: [string, number, number][] = [
      ['Welcome to the product demo.', 1.2, 4.5],
      ["Today we'll look at the cloud architecture.", 5.14, 9.8],
      ['It indexes every upload automatically.', 12.3, 16.99],
      ['Ask questions any time.', 105.6, 109.02],
      ['Ask questions any time.', 121.15, 124],
      ['Thanks for watching.', 125, 127.04],
    ];

    expect(lines).toHaveLength(expected.length);
    expected.forEach(([text, startSeconds, endSeconds], i) => {
      expect(lines[i]?.text).toBe(text);
      expect(lines[i]?.startSeconds).toBeCloseTo(startSeconds, 6);
      expect(lines[i]?.endSeconds).toBeCloseTo(endSeconds, 6);
    });
  });

  it('skips silence entries (empty text) and trims whitespace', () => {
    const texts = parseTranscript(processed).map((line) => line.text);
    expect(texts).not.toContain('');
    expect(texts).toContain('It indexes every upload automatically.');
  });

  it('returns empty for indexes without a transcript section', () => {
    expect(parseTranscript(minimal)).toEqual([]);
    expect(parseTranscript(failed)).toEqual([]);
  });

  it('falls back to start/end when adjusted times are absent and sorts by start', () => {
    const index: ViIndex = {
      state: 'Processed',
      videos: [
        {
          state: 'Processed',
          insights: {
            transcript: [
              { text: 'second', instances: [{ start: '0:00:10', end: '0:00:12' }] },
              { text: 'first', instances: [{ start: '0:00:01', end: '0:00:02' }] },
            ],
          },
        },
      ],
    };

    expect(parseTranscript(index).map((line) => line.text)).toEqual(['first', 'second']);
  });
});

describe('parseKeywords', () => {
  it('ranks by confidence and dedupes case-insensitively', () => {
    expect(parseKeywords(processed)).toEqual([
      'product demo',
      'cloud architecture',
      'serverless pipeline',
    ]);
  });

  it('returns empty when the section is missing', () => {
    expect(parseKeywords(minimal)).toEqual([]);
    expect(parseKeywords(failed)).toEqual([]);
  });

  it('drops blank keywords and treats missing confidence as lowest', () => {
    const index: ViIndex = {
      state: 'Processed',
      videos: [
        {
          state: 'Processed',
          insights: {
            keywords: [
              { text: '   ', confidence: 0.9 },
              { text: 'unscored' },
              { text: 'scored', confidence: 0.1 },
            ],
          },
        },
      ],
    };

    expect(parseKeywords(index)).toEqual(['scored', 'unscored']);
  });
});

describe('parseTopics', () => {
  it('ranks topic names by confidence', () => {
    expect(parseTopics(processed)).toEqual([
      'Cloud Computing',
      'Artificial Intelligence',
      'Product Demonstrations',
    ]);
  });

  it('returns empty when the section is missing', () => {
    expect(parseTopics(minimal)).toEqual([]);
    expect(parseTopics(failed)).toEqual([]);
  });

  it('treats missing topic confidence as lowest', () => {
    const index: ViIndex = {
      state: 'Processed',
      videos: [
        {
          state: 'Processed',
          insights: {
            topics: [
              { name: 'Unscored', instances: [] },
              { name: 'Scored', confidence: 0.2, instances: [] },
            ],
          },
        },
      ],
    };
    expect(parseTopics(index)).toEqual(['Scored', 'Unscored']);
  });
});

describe('parseChapters', () => {
  it('derives chapters from scenes, titled by the topic with the largest overlap', () => {
    const chapters = parseChapters(processed);

    const expected: [string, number, number][] = [
      ['Cloud Computing', 0, 45.2],
      ['Artificial Intelligence', 45.2, 90],
      ['Product Demonstrations', 90, 127.04],
    ];

    expect(chapters).toHaveLength(expected.length);
    expected.forEach(([title, startSeconds, endSeconds], i) => {
      expect(chapters[i]?.title).toBe(title);
      expect(chapters[i]?.startSeconds).toBeCloseTo(startSeconds, 6);
      expect(chapters[i]?.endSeconds).toBeCloseTo(endSeconds, 6);
    });
  });

  it('numbers chapters when no topic overlaps a scene', () => {
    const index: ViIndex = {
      state: 'Processed',
      videos: [
        {
          state: 'Processed',
          insights: {
            scenes: [
              { instances: [{ start: '0:00:30', end: '0:01:00' }] },
              { instances: [{ start: '0:00:00', end: '0:00:30' }] },
            ],
          },
        },
      ],
    };

    expect(parseChapters(index)).toEqual([
      { title: 'Chapter 1', startSeconds: 0, endSeconds: 30 },
      { title: 'Chapter 2', startSeconds: 30, endSeconds: 60 },
    ]);
  });

  it('falls back to topic appearances when the index has no scenes', () => {
    const index: ViIndex = {
      state: 'Processed',
      videos: [
        {
          state: 'Processed',
          insights: {
            topics: [
              {
                name: 'Later Topic',
                confidence: 0.9,
                instances: [{ start: '0:01:00', end: '0:02:00' }],
              },
              {
                name: 'Early Topic',
                confidence: 0.5,
                instances: [
                  { start: '0:00:05', end: '0:00:30' },
                  { start: '0:03:00', end: '0:03:30' },
                ],
              },
              { name: 'No Appearances', confidence: 0.4, instances: [] },
            ],
          },
        },
      ],
    };

    expect(parseChapters(index)).toEqual([
      { title: 'Early Topic', startSeconds: 5, endSeconds: 30 },
      { title: 'Later Topic', startSeconds: 60, endSeconds: 120 },
    ]);
  });

  it('returns empty when there are neither scenes nor topics', () => {
    expect(parseChapters(minimal)).toEqual([]);
    expect(parseChapters(failed)).toEqual([]);
  });

  it('ignores scenes without instances', () => {
    const index: ViIndex = {
      state: 'Processed',
      videos: [{ state: 'Processed', insights: { scenes: [{ instances: [] }] } }],
    };

    expect(parseChapters(index)).toEqual([]);
  });
});

describe('parseThumbnailId', () => {
  it('prefers the video-level thumbnail', () => {
    expect(parseThumbnailId(processed)).toBe('9c2f6a1e-8f2b-4a6f-b1de-4a1b9c0d2e3f');
  });

  it('falls back to the summarized insights thumbnail', () => {
    expect(parseThumbnailId(minimal)).toBe('5e6f7a8b-1111-4222-8333-944444444444');
  });

  it('returns null when no thumbnail exists', () => {
    expect(parseThumbnailId(failed)).toBeNull();
  });
});

describe('parseDuration', () => {
  it('prefers the root durationInSeconds', () => {
    expect(parseDuration(processed)).toBe(127);
    expect(parseDuration(minimal)).toBe(8);
  });

  it('falls back to summarized insights seconds', () => {
    const index: ViIndex = {
      state: 'Processed',
      videos: [],
      summarizedInsights: { duration: { seconds: 42.5 } },
    };
    expect(parseDuration(index)).toBeCloseTo(42.5, 6);
  });

  it('falls back to the per-video insights duration timecode', () => {
    const index: ViIndex = {
      state: 'Processed',
      videos: [
        { state: 'Processed' },
        { state: 'Processed', insights: { duration: '0:02:07.04' } },
      ],
    };
    expect(parseDuration(index)).toBeCloseTo(127.04, 6);
  });

  it('returns 0 when no duration is available anywhere', () => {
    const index: ViIndex = {
      state: 'Processed',
      videos: [{ state: 'Processed', insights: {} }],
      summarizedInsights: {},
    };
    expect(parseDuration(index)).toBe(0);
  });
});

describe('parseFailure', () => {
  it('returns null for successful indexes', () => {
    expect(parseFailure(processed)).toBeNull();
    expect(parseFailure(minimal)).toBeNull();
  });

  it('surfaces the failure code and message', () => {
    expect(parseFailure(failed)).toEqual({
      code: 'UnsupportedFileType',
      message: 'The file type is not supported for indexing. See the list of supported formats.',
    });
  });

  it('returns null when failure fields are absent entirely', () => {
    const index: ViIndex = { state: 'Processed', videos: [{ state: 'Processed' }] };
    expect(parseFailure(index)).toBeNull();
  });

  it('reports a failure message even without a failure code', () => {
    const index: ViIndex = {
      state: 'Failed',
      videos: [{ state: 'Failed', failureMessage: 'boom' }],
    };
    expect(parseFailure(index)).toEqual({ code: 'None', message: 'boom' });
  });
});

describe('extractInsights', () => {
  it('composes every parser over a processed index', () => {
    const insights = extractInsights(processed);

    expect(insights.durationInSeconds).toBe(127);
    expect(insights.transcript).toHaveLength(6);
    expect(insights.keywords).toEqual([
      'product demo',
      'cloud architecture',
      'serverless pipeline',
    ]);
    expect(insights.topics).toEqual([
      'Cloud Computing',
      'Artificial Intelligence',
      'Product Demonstrations',
    ]);
    expect(insights.chapters).toHaveLength(3);
    expect(insights.thumbnailId).toBe('9c2f6a1e-8f2b-4a6f-b1de-4a1b9c0d2e3f');
    expect(insights.failure).toBeNull();
  });

  it('yields empty insights plus a failure for a failed index', () => {
    const insights = extractInsights(failed);

    expect(insights).toEqual({
      durationInSeconds: 0,
      transcript: [],
      keywords: [],
      topics: [],
      chapters: [],
      thumbnailId: null,
      failure: {
        code: 'UnsupportedFileType',
        message: 'The file type is not supported for indexing. See the list of supported formats.',
      },
    });
  });
});
