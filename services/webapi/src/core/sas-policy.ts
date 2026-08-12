/**
 * SAS windows computed by core policy; adapters do the actual signing (via a user
 * delegation key in production — zero data-plane secrets, plan §5).
 */
export interface SasWindow {
  startsOn: Date;
  expiresOn: Date;
}

/** Write-only window for the browser's direct blob PUT. */
export interface WriteSasPolicy extends SasWindow {
  permissions: 'cw';
}

/** Read-only window for playback, captions, and downloads. */
export interface ReadSasPolicy extends SasWindow {
  permissions: 'r';
}

/** Backdate SAS validity so storage-vs-caller clock skew never yields 403s. */
export const SAS_CLOCK_SKEW_MINUTES = 5;

/** Upload SAS lifetime (plan §4: write-only SAS, 15 min). */
export const UPLOAD_SAS_MINUTES = 15;

/**
 * Playback/captions SAS lifetime. Long enough for a feature-length watch session
 * (the player re-uses one URL for every range request while seeking); short enough
 * that a leaked URL goes stale within the hour.
 */
export const PLAYBACK_SAS_MINUTES = 60;

/** Download links are clicked immediately; keep them as short as the upload window. */
export const DOWNLOAD_SAS_MINUTES = 15;

const MINUTE_MS = 60_000;

function window(now: Date, validMinutes: number): SasWindow {
  return {
    startsOn: new Date(now.getTime() - SAS_CLOCK_SKEW_MINUTES * MINUTE_MS),
    expiresOn: new Date(now.getTime() + validMinutes * MINUTE_MS),
  };
}

/** SAS for the browser's direct upload PUT (plan §2 flow note 1). */
export function uploadWriteSasPolicy(now: Date): WriteSasPolicy {
  return { permissions: 'cw', ...window(now, UPLOAD_SAS_MINUTES) };
}

/** SAS for watch-page playback and the captions text track (plan §2 flow note 7). */
export function playbackReadSasPolicy(now: Date): ReadSasPolicy {
  return { permissions: 'r', ...window(now, PLAYBACK_SAS_MINUTES) };
}

/** SAS for source-video download links. */
export function downloadReadSasPolicy(now: Date): ReadSasPolicy {
  return { permissions: 'r', ...window(now, DOWNLOAD_SAS_MINUTES) };
}
