import { describe, expect, it } from 'vitest';

import { buildChaptersVtt } from '@/lib/chapters-vtt';

describe('buildChaptersVtt', () => {
  it('builds a WEBVTT document with one cue per chapter', () => {
    const vtt = buildChaptersVtt([
      { title: 'Introductions', startSeconds: 0, endSeconds: 60 },
      { title: 'The launch date', startSeconds: 60, endSeconds: 252.5 },
    ]);
    expect(vtt).toBe(
      [
        'WEBVTT',
        '00:00:00.000 --> 00:01:00.000\nIntroductions',
        '00:01:00.000 --> 00:04:12.500\nThe launch date',
      ].join('\n\n'),
    );
  });

  it('returns a bare header for no chapters', () => {
    expect(buildChaptersVtt([])).toBe('WEBVTT');
  });

  it('collapses newlines and neutralizes cue-timing arrows in titles', () => {
    const vtt = buildChaptersVtt([{ title: 'a\nb --> c', startSeconds: 0, endSeconds: 1 }]);
    expect(vtt).toContain('a b → c');
    expect(vtt.split('-->')).toHaveLength(2);
  });

  it('falls back to a numbered title for blank chapter names', () => {
    const vtt = buildChaptersVtt([{ title: '   ', startSeconds: 0, endSeconds: 1 }]);
    expect(vtt).toContain('Chapter 1');
  });
});
