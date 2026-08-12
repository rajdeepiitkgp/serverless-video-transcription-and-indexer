/** Location of an uploaded video inside the videos container: `{uploadId}/{fileName}` (plan §2). */
export interface UploadBlobPath {
  uploadId: string;
  fileName: string;
  /** Container-relative blob name, URL-decoded. */
  blobName: string;
}

/**
 * Extracts the upload id and file name from a BlobCreated event's blob URL.
 *
 * Handles both production (`https://{account}.blob.core.windows.net/videos/…`) and
 * emulator (`http://127.0.0.1:10000/devstoreaccount1/videos/…`) URL shapes by locating
 * the container segment. Returns null for anything that isn't a
 * `{container}/{uploadId}/{fileName}` blob — the Event Grid subscription is filtered to
 * the videos container (plan §2), but filtering is the subscription's job, validation
 * is ours.
 */
export function parseVideoBlobUrl(blobUrl: string, videosContainer: string): UploadBlobPath | null {
  let url: URL;
  try {
    url = new URL(blobUrl);
  } catch {
    return null;
  }

  const segments = url.pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map(decodeURIComponent);

  // Container is the first segment (production) or follows the account segment (emulator).
  const containerIndex = segments.findIndex(
    (segment, index) => index <= 1 && segment === videosContainer,
  );
  if (containerIndex === -1) return null;

  const uploadId = segments[containerIndex + 1];
  const fileName = segments.slice(containerIndex + 2).join('/');
  if (uploadId === undefined || uploadId === '' || fileName === '') return null;

  return { uploadId, fileName, blobName: `${uploadId}/${fileName}` };
}
