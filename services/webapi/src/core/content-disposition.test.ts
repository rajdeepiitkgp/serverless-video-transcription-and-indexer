import { describe, expect, it } from 'vitest';

import { attachmentDisposition, transcriptDownloadFileName } from './content-disposition.js';

describe('attachmentDisposition', () => {
  it('quotes a plain ASCII name without an encoded variant', () => {
    expect(attachmentDisposition('demo.mp4')).toBe('attachment; filename="demo.mp4"');
  });

  it('escapes quotes in the fallback and adds the UTF-8 variant', () => {
    expect(attachmentDisposition('my "clip".mp4')).toBe(
      `attachment; filename="my _clip_.mp4"; filename*=UTF-8''my%20%22clip%22.mp4`,
    );
  });

  it('substitutes non-ASCII characters in the fallback and preserves them encoded', () => {
    expect(attachmentDisposition('vidéo.mp4')).toBe(
      `attachment; filename="vid_o.mp4"; filename*=UTF-8''vid%C3%A9o.mp4`,
    );
  });
});

describe('transcriptDownloadFileName', () => {
  it('swaps the video extension for the transcript format', () => {
    expect(transcriptDownloadFileName('demo.mp4', 'vtt')).toBe('demo.vtt');
    expect(transcriptDownloadFileName('demo.mp4', 'json')).toBe('demo.json');
  });

  it('appends the format when the name has no extension', () => {
    expect(transcriptDownloadFileName('demo', 'vtt')).toBe('demo.vtt');
  });

  it('only strips the final extension', () => {
    expect(transcriptDownloadFileName('archive.tar.mp4', 'vtt')).toBe('archive.tar.vtt');
  });
});
