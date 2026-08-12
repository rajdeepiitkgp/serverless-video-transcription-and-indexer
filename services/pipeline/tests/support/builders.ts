import { type VideoDocument, videoDocumentSchema } from '@vidx/shared';

/** A valid `Uploaded` document as the webapi would create it at SAS issuance (plan §5). */
export function videoDocument(overrides: Partial<VideoDocument> = {}): VideoDocument {
  return videoDocumentSchema.parse({
    id: 'upl-0001',
    videoId: null,
    schemaVersion: 1,
    name: 'demo.mp4',
    blobPath: 'videos/upl-0001/demo.mp4',
    playable: true,
    status: 'Uploaded',
    uploadedBy: { userId: 'user-1', userDetails: 'user@example.com' },
    resultsPrefix: 'results/upl-0001/',
    trackingIds: { upload: 'VXT-11111111' },
    ...overrides,
  });
}
