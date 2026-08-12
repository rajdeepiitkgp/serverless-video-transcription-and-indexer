import { type ReadSasPolicy, type WriteSasPolicy } from '../core/sas-policy.js';

export interface ReadSasOptions {
  /** `Content-Disposition` the blob endpoint should answer with (downloads). */
  contentDisposition?: string;
}

/** The videos container: SAS issuance for upload/playback/download + source deletion. */
export interface VideoBlobStore {
  /** Write-only SAS URL for the browser's direct PUT (plan §2 flow note 1). */
  createUploadSasUrl(blobName: string, policy: WriteSasPolicy): Promise<string>;
  /** Read SAS URL for playback and downloads. */
  createReadSasUrl(
    blobName: string,
    policy: ReadSasPolicy,
    options?: ReadSasOptions,
  ): Promise<string>;
  /** Deleting a missing blob is a no-op (delete must be idempotent). */
  delete(blobName: string): Promise<void>;
}
