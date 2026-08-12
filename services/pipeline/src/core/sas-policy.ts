/** Read-only SAS window computed by core policy; adapters do the actual signing. */
export interface ReadSasPolicy {
  permissions: 'r';
  startsOn: Date;
  expiresOn: Date;
}

/** Backdate SAS validity so storage-vs-caller clock skew never yields 403s. */
export const SAS_CLOCK_SKEW_MINUTES = 5;

/**
 * Video Indexer downloads the source asynchronously after submission — queue wait
 * plus transfer for multi-GB files. Six hours is generous headroom while keeping the
 * URL short-lived (the SAS is read-only, on one private blob, and never leaves the
 * pipeline → VI submission).
 */
export const VI_SOURCE_READ_SAS_HOURS = 6;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** SAS window handed to Video Indexer for reading the uploaded source blob (plan §2 flow note 2). */
export function viSourceReadSasPolicy(now: Date): ReadSasPolicy {
  return {
    permissions: 'r',
    startsOn: new Date(now.getTime() - SAS_CLOCK_SKEW_MINUTES * MINUTE_MS),
    expiresOn: new Date(now.getTime() + VI_SOURCE_READ_SAS_HOURS * HOUR_MS),
  };
}
