import * as z from 'zod';

/**
 * Upper bound the webapi enforces at SAS issuance. 2 GiB keeps a single-block-list
 * browser upload comfortable and stays far inside VI's per-file limits; bump here
 * (one place) if larger sources become a requirement.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

/** POST /api/uploads request body. */
export const uploadRequestSchema = z
  .object({
    fileName: z.string().min(1).max(1024),
    contentType: z.string().min(1).max(255),
    sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  })
  .meta({ id: 'UploadRequest' });

export type UploadRequest = z.infer<typeof uploadRequestSchema>;

/**
 * POST /api/uploads response: the write-only SAS target plus the playability verdict
 * (`playable: false` triggers the "can't be previewed in the browser" warning before
 * the upload starts — plan §4).
 */
export const uploadResponseSchema = z
  .object({
    uploadId: z.string().min(1),
    uploadUrl: z.url(),
    blobPath: z.string().min(1),
    playable: z.boolean(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'UploadResponse' });

export type UploadResponse = z.infer<typeof uploadResponseSchema>;
