import { describe, expect, it } from 'vitest';

import { parseVideoBlobUrl } from './blob-path.js';

describe('parseVideoBlobUrl', () => {
  it('parses a production blob URL', () => {
    expect(
      parseVideoBlobUrl('https://vidxsa.blob.core.windows.net/videos/upl-1/demo.mp4', 'videos'),
    ).toEqual({ uploadId: 'upl-1', fileName: 'demo.mp4', blobName: 'upl-1/demo.mp4' });
  });

  it('parses an emulator-style URL where the account name precedes the container', () => {
    expect(
      parseVideoBlobUrl('http://127.0.0.1:10000/devstoreaccount1/videos/upl-2/clip.webm', 'videos'),
    ).toEqual({ uploadId: 'upl-2', fileName: 'clip.webm', blobName: 'upl-2/clip.webm' });
  });

  it('URL-decodes path segments', () => {
    expect(
      parseVideoBlobUrl(
        'https://vidxsa.blob.core.windows.net/videos/upl-3/My%20Talk%20%231.mp4',
        'videos',
      ),
    ).toEqual({ uploadId: 'upl-3', fileName: 'My Talk #1.mp4', blobName: 'upl-3/My Talk #1.mp4' });
  });

  it('keeps nested path segments as part of the file name', () => {
    expect(
      parseVideoBlobUrl('https://vidxsa.blob.core.windows.net/videos/upl-4/a/b.mp4', 'videos'),
    ).toEqual({ uploadId: 'upl-4', fileName: 'a/b.mp4', blobName: 'upl-4/a/b.mp4' });
  });

  it('returns null for a different container', () => {
    expect(
      parseVideoBlobUrl('https://vidxsa.blob.core.windows.net/results/upl-1/x.json', 'videos'),
    ).toBeNull();
  });

  it('returns null when the container appears too deep in the path to be real', () => {
    expect(
      parseVideoBlobUrl('https://vidxsa.blob.core.windows.net/a/b/videos/upl-1/x.mp4', 'videos'),
    ).toBeNull();
  });

  it('returns null when the blob has no file name under the upload id', () => {
    expect(parseVideoBlobUrl('https://vidxsa.blob.core.windows.net/videos/upl-1', 'videos')).toBe(
      null,
    );
    expect(parseVideoBlobUrl('https://vidxsa.blob.core.windows.net/videos/upl-1/', 'videos')).toBe(
      null,
    );
  });

  it('returns null for an unparseable URL', () => {
    expect(parseVideoBlobUrl('not a url', 'videos')).toBeNull();
  });
});
