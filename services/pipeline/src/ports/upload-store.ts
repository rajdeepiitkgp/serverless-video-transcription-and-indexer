import { type ReadSasPolicy } from '../core/sas-policy.js';

/** The videos container: hands Video Indexer a read SAS for the source blob. */
export interface UploadStore {
  createReadSasUrl(blobName: string, policy: ReadSasPolicy): Promise<string>;
}
