import {
  BlobSASPermissions,
  type BlobServiceClient,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
  type UserDelegationKey,
} from '@azure/storage-blob';

import { type ReadSasPolicy, type WriteSasPolicy } from '../core/sas-policy.js';
import { type ResultsStore } from '../ports/results-store.js';
import { type ReadSasOptions, type VideoBlobStore } from '../ports/video-blob-store.js';

interface SasSigningOptions {
  policy: WriteSasPolicy | ReadSasPolicy;
  contentDisposition?: string | undefined;
}

/**
 * Blob adapters over one `BlobServiceClient`. In production the client carries a
 * TokenCredential (managed identity) and SAS generation goes through a user
 * delegation key — zero data-plane secrets (plan §5). Against Azurite the client
 * carries a shared-key credential and signs directly.
 */
async function createSasUrl(
  service: BlobServiceClient,
  containerName: string,
  blobName: string,
  { policy, contentDisposition }: SasSigningOptions,
): Promise<string> {
  const blobUrl = service.getContainerClient(containerName).getBlobClient(blobName).url;
  const sasOptions = {
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse(policy.permissions),
    startsOn: policy.startsOn,
    expiresOn: policy.expiresOn,
    ...(contentDisposition === undefined ? {} : { contentDisposition }),
  };

  let sas: string;
  if (service.credential instanceof StorageSharedKeyCredential) {
    sas = generateBlobSASQueryParameters(sasOptions, service.credential).toString();
  } else {
    const delegationKey: UserDelegationKey = await service.getUserDelegationKey(
      policy.startsOn,
      policy.expiresOn,
    );
    sas = generateBlobSASQueryParameters(sasOptions, delegationKey, service.accountName).toString();
  }
  return `${blobUrl}?${sas}`;
}

export function createVideoBlobStore(
  service: BlobServiceClient,
  containerName: string,
): VideoBlobStore {
  return {
    createUploadSasUrl(blobName: string, policy: WriteSasPolicy): Promise<string> {
      return createSasUrl(service, containerName, blobName, { policy });
    },

    createReadSasUrl(
      blobName: string,
      policy: ReadSasPolicy,
      options?: ReadSasOptions,
    ): Promise<string> {
      return createSasUrl(service, containerName, blobName, {
        policy,
        contentDisposition: options?.contentDisposition,
      });
    },

    async delete(blobName: string): Promise<void> {
      await service.getContainerClient(containerName).getBlobClient(blobName).deleteIfExists();
    },
  };
}

export function createBlobResultsStore(
  service: BlobServiceClient,
  containerName: string,
): ResultsStore {
  const container = service.getContainerClient(containerName);
  return {
    async read(blobName: string): Promise<string | null> {
      try {
        const buffer = await container.getBlobClient(blobName).downloadToBuffer();
        return buffer.toString('utf8');
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'statusCode' in error &&
          error.statusCode === 404
        ) {
          return null;
        }
        throw error;
      }
    },

    createReadSasUrl(blobName: string, policy: ReadSasPolicy): Promise<string> {
      return createSasUrl(service, containerName, blobName, { policy });
    },

    async deletePrefix(prefix: string): Promise<void> {
      for await (const blob of container.listBlobsFlat({ prefix })) {
        await container.getBlobClient(blob.name).deleteIfExists();
      }
    },
  };
}
