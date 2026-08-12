import {
  BlobSASPermissions,
  type BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';

import { diagnosticsBlobName } from '../core/results-layout.js';
import { type ReadSasPolicy } from '../core/sas-policy.js';
import { type DiagnosticsStore } from '../ports/diagnostics-store.js';
import { type ResultsStore } from '../ports/results-store.js';
import { type UploadStore } from '../ports/upload-store.js';

/**
 * Blob adapters over one `BlobServiceClient`. In production the client carries a
 * TokenCredential (managed identity) and SAS generation goes through a user
 * delegation key — zero data-plane secrets (plan §5). Against Azurite the client
 * carries a shared-key credential and signs directly.
 */
export function createBlobUploadStore(
  service: BlobServiceClient,
  containerName: string,
): UploadStore {
  return {
    async createReadSasUrl(blobName: string, policy: ReadSasPolicy): Promise<string> {
      const blobUrl = service.getContainerClient(containerName).getBlobClient(blobName).url;
      const sasOptions = {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse(policy.permissions),
        startsOn: policy.startsOn,
        expiresOn: policy.expiresOn,
      };

      if (service.credential instanceof StorageSharedKeyCredential) {
        return `${blobUrl}?${generateBlobSASQueryParameters(sasOptions, service.credential).toString()}`;
      }

      const delegationKey = await service.getUserDelegationKey(policy.startsOn, policy.expiresOn);
      const sas = generateBlobSASQueryParameters(sasOptions, delegationKey, service.accountName);
      return `${blobUrl}?${sas.toString()}`;
    },
  };
}

export function createBlobResultsStore(
  service: BlobServiceClient,
  containerName: string,
): ResultsStore {
  return {
    async write(blobName: string, body: string | Uint8Array, contentType: string): Promise<void> {
      const data = typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.from(body);
      await service
        .getContainerClient(containerName)
        .getBlockBlobClient(blobName)
        .uploadData(data, { blobHTTPHeaders: { blobContentType: contentType } });
    },
  };
}

/** Same container as results; entries land under `{uploadId}/diagnostics/` (plan §7). */
export function createBlobDiagnosticsStore(
  service: BlobServiceClient,
  containerName: string,
): DiagnosticsStore {
  const results = createBlobResultsStore(service, containerName);
  return {
    write: (uploadId, entryName, body, contentType) =>
      results.write(diagnosticsBlobName(uploadId, entryName), body, contentType),
  };
}
