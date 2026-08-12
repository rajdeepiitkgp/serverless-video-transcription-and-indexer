import { type ReadSasPolicy } from '../core/sas-policy.js';

/**
 * The results container, read-side: captions for transcript downloads and the
 * captions SAS for the player's text track; prefix deletion for video deletes
 * (plan §4: delete removes blob + results + metadata).
 */
export interface ResultsStore {
  /** UTF-8 content of a results blob, or null if it does not exist. */
  read(blobName: string): Promise<string | null>;
  createReadSasUrl(blobName: string, policy: ReadSasPolicy): Promise<string>;
  /** Deletes every blob under the prefix, diagnostics included. */
  deletePrefix(prefix: string): Promise<void>;
}
