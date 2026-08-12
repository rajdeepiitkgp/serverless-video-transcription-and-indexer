import { type UploadRequest } from '@vidx/shared';
import { describe, expect, it } from 'vitest';

import {
  createUploadedDocument,
  sourceBlobName,
  uploadBlobName,
  validateUpload,
} from './upload-policy.js';

function upload(overrides: Partial<UploadRequest> = {}): UploadRequest {
  return { fileName: 'demo.mp4', contentType: 'video/mp4', sizeBytes: 1024, ...overrides };
}

describe('validateUpload', () => {
  it('accepts a browser-playable format', () => {
    expect(validateUpload(upload())).toEqual({ ok: true, playable: true });
  });

  it.each(['mp4', 'm4v', 'webm', 'ogg', 'ogv'])('flags .%s as playable', (extension) => {
    expect(validateUpload(upload({ fileName: `clip.${extension}` }))).toEqual({
      ok: true,
      playable: true,
    });
  });

  it.each(['mov', 'avi', 'mkv', 'wmv', 'flv', 'mxf'])(
    'accepts .%s as indexable but not playable',
    (extension) => {
      expect(validateUpload(upload({ fileName: `clip.${extension}` }))).toEqual({
        ok: true,
        playable: false,
      });
    },
  );

  it('judges by extension, not the browser-supplied content type', () => {
    expect(validateUpload(upload({ contentType: 'application/octet-stream' }))).toEqual({
      ok: true,
      playable: true,
    });
  });

  it('is case-insensitive on the extension', () => {
    expect(validateUpload(upload({ fileName: 'CLIP.MP4' }))).toEqual({ ok: true, playable: true });
  });

  it('rejects non-video formats', () => {
    const result = validateUpload(upload({ fileName: 'malware.exe' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unsupported_format');
      expect(result.message).toContain('.exe');
    }
  });

  it('rejects file names without an extension', () => {
    expect(validateUpload(upload({ fileName: 'noextension' }))).toMatchObject({
      ok: false,
      reason: 'unsupported_format',
    });
  });

  it('rejects dotfiles', () => {
    expect(validateUpload(upload({ fileName: '.mp4' }))).toMatchObject({
      ok: false,
      reason: 'unsupported_format',
    });
  });

  it('rejects a trailing dot', () => {
    expect(validateUpload(upload({ fileName: 'clip.' }))).toMatchObject({
      ok: false,
      reason: 'unsupported_format',
    });
  });

  it('allows spaces inside a file name', () => {
    expect(validateUpload(upload({ fileName: 'my holiday video.mp4' }))).toEqual({
      ok: true,
      playable: true,
    });
  });

  it.each(['a/b.mp4', 'a\\b.mp4', 'evil\tname.mp4', ' padded.mp4', 'padded.mp4 '])(
    'rejects unsafe file name %j',
    (fileName) => {
      expect(validateUpload(upload({ fileName }))).toMatchObject({
        ok: false,
        reason: 'unsafe_file_name',
      });
    },
  );
});

describe('blob naming', () => {
  it('places uploads under the uploadId', () => {
    expect(uploadBlobName('upl-1', 'demo.mp4')).toBe('upl-1/demo.mp4');
  });

  it('derives the container-relative name from a stored blobPath', () => {
    expect(sourceBlobName('videos/upl-1/demo.mp4')).toBe('upl-1/demo.mp4');
  });
});

describe('createUploadedDocument', () => {
  it('creates a schema-valid Uploaded document stamped with the caller identity', () => {
    const document = createUploadedDocument({
      uploadId: 'upl-1',
      upload: upload(),
      playable: true,
      uploadedBy: { userId: 'user-1', userDetails: 'user@example.com' },
      trackingId: 'VXT-11111111',
      videosContainer: 'videos',
      resultsContainer: 'results',
    });

    expect(document).toEqual({
      id: 'upl-1',
      videoId: null,
      schemaVersion: 1,
      name: 'demo.mp4',
      blobPath: 'videos/upl-1/demo.mp4',
      playable: true,
      status: 'Uploaded',
      uploadedBy: { userId: 'user-1', userDetails: 'user@example.com' },
      keywords: [],
      topics: [],
      transcript: [],
      chapters: [],
      resultsPrefix: 'results/upl-1/',
      trackingIds: { upload: 'VXT-11111111' },
      error: null,
    });
  });
});
