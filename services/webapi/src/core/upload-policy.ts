import {
  type TrackingId,
  type UploadedBy,
  type UploadRequest,
  VIDEO_DOCUMENT_SCHEMA_VERSION,
  type VideoDocument,
  videoDocumentSchema,
} from '@vidx/shared';

/**
 * Playability rules (plan §14 risk "browser can't play every VI-indexable format").
 * Verdicts go by file extension, not the request's contentType: browsers derive
 * `File.type` from OS mappings and routinely send blanks or `application/octet-stream`,
 * while the extension is what the user actually sees. `playable: false` is a warning,
 * never a rejection — the format still indexes, and the watch page shows the
 * download-only fallback (plan §4).
 */
export const BROWSER_PLAYABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'mp4',
  'm4v',
  'webm',
  'ogg',
  'ogv',
]);

/** Container formats Azure Video Indexer accepts, per its supported-media matrix. */
export const INDEXABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  ...BROWSER_PLAYABLE_EXTENSIONS,
  '3gp',
  '3gpp',
  'asf',
  'avi',
  'flv',
  'gxf',
  'mkv',
  'mov',
  'mpg',
  'mpeg',
  'mxf',
  'ps',
  'ts',
  'wmv',
]);

export type UploadRejection =
  | { reason: 'unsafe_file_name'; message: string }
  | { reason: 'unsupported_format'; message: string };

export type UploadValidation = { ok: true; playable: boolean } | ({ ok: false } & UploadRejection);

function extensionOf(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) return null;
  return fileName.slice(dot + 1).toLowerCase();
}

/** Path separators and control characters have no place in a blob name. */
// eslint-disable-next-line no-control-regex -- rejecting control characters is the point
const UNSAFE_FILE_NAME = /[\u0000-\u001f\u007f/\\]/;

/**
 * Type/size gate at SAS issuance (plan §2 flow note 1). Size and shape are already
 * schema-enforced by `uploadRequestSchema`; this adds the semantic rules: a blob-safe
 * file name and a VI-indexable container format, plus the playability verdict.
 */
export function validateUpload(upload: UploadRequest): UploadValidation {
  const fileName = upload.fileName;
  if (UNSAFE_FILE_NAME.test(fileName) || fileName.trim() !== fileName || fileName === '') {
    return {
      ok: false,
      reason: 'unsafe_file_name',
      message:
        'File name must not contain path separators, control characters, or surrounding whitespace.',
    };
  }

  const extension = extensionOf(fileName);
  if (extension === null || !INDEXABLE_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      reason: 'unsupported_format',
      message: `Unsupported video format${extension === null ? '' : ` ".${extension}"`}. Supported: ${[...INDEXABLE_EXTENSIONS].sort().join(', ')}.`,
    };
  }

  return { ok: true, playable: BROWSER_PLAYABLE_EXTENSIONS.has(extension) };
}

/** Container-relative blob name for a new upload: `{uploadId}/{fileName}` (plan §2). */
export function uploadBlobName(uploadId: string, fileName: string): string {
  return `${uploadId}/${fileName}`;
}

/**
 * Container-relative blob name from a stored `blobPath` (`videos/{uploadId}/{file}`,
 * plan §5 — the first segment is the container).
 */
export function sourceBlobName(blobPath: string): string {
  return blobPath.split('/').slice(1).join('/');
}

export interface NewUpload {
  uploadId: string;
  upload: UploadRequest;
  playable: boolean;
  uploadedBy: UploadedBy;
  trackingId: TrackingId;
  videosContainer: string;
  resultsContainer: string;
}

/**
 * The `Uploaded` Cosmos document created at SAS issuance, stamped with the caller's
 * identity (plan §2 flow note 1, §5). Parsed through the shared schema so an invalid
 * document can never leave core.
 */
export function createUploadedDocument(input: NewUpload): VideoDocument {
  return videoDocumentSchema.parse({
    id: input.uploadId,
    videoId: null,
    schemaVersion: VIDEO_DOCUMENT_SCHEMA_VERSION,
    name: input.upload.fileName,
    blobPath: `${input.videosContainer}/${uploadBlobName(input.uploadId, input.upload.fileName)}`,
    playable: input.playable,
    status: 'Uploaded',
    uploadedBy: input.uploadedBy,
    resultsPrefix: `${input.resultsContainer}/${input.uploadId}/`,
    trackingIds: { upload: input.trackingId },
    error: null,
  });
}
