import { type TokenCredential } from '@azure/identity';
import * as z from 'zod';

import { type Clock } from '../ports/clock.js';
import {
  type SubmittedVideo,
  type SubmitVideoRequest,
  type VideoIndexerClient,
  VideoIndexerRequestError,
} from '../ports/video-indexer-client.js';

/**
 * Video Indexer over ARM + REST, exactly as plan §2 deviation 1 prescribes: the
 * account token comes from the ARM `generateAccessToken` action authorized by
 * managed identity — the deprecated key-based/classic auth is never used.
 *
 * The ARM api-version is configurable (risk table: "VI ARM API details drift");
 * live verification against a deployed account happens with M5 infra.
 */
export const DEFAULT_ARM_ENDPOINT = 'https://management.azure.com';
export const DEFAULT_VI_API_ENDPOINT = 'https://api.videoindexer.ai';
export const DEFAULT_VI_ARM_API_VERSION = '2024-01-01';

/** VI account tokens live for an hour; refresh comfortably before that. */
const TOKEN_REUSE_MS = 50 * 60_000;

export interface VideoIndexerRestClientOptions {
  credential: TokenCredential;
  subscriptionId: string;
  resourceGroup: string;
  accountName: string;
  /** The VI account's internal id (GUID), used in data-plane URLs. */
  accountId: string;
  location: string;
  clock: Clock;
  armEndpoint?: string;
  apiEndpoint?: string;
  armApiVersion?: string;
}

const accessTokenSchema = z.object({ accessToken: z.string().min(1) });
const submitResponseSchema = z.object({ id: z.string().min(1), state: z.string() });

export function createVideoIndexerRestClient(
  options: VideoIndexerRestClientOptions,
): VideoIndexerClient {
  const armEndpoint = (options.armEndpoint ?? DEFAULT_ARM_ENDPOINT).replace(/\/$/, '');
  const apiEndpoint = (options.apiEndpoint ?? DEFAULT_VI_API_ENDPOINT).replace(/\/$/, '');
  const armApiVersion = options.armApiVersion ?? DEFAULT_VI_ARM_API_VERSION;

  let cached: { token: string; fetchedAt: number } | null = null;

  async function armToken(): Promise<string> {
    const token = await options.credential.getToken(`${armEndpoint}/.default`);
    if (token === null) throw new Error('Could not acquire an ARM token for Video Indexer');
    return token.token;
  }

  async function accountToken(): Promise<string> {
    const now = options.clock.now().getTime();
    if (cached !== null && now - cached.fetchedAt < TOKEN_REUSE_MS) return cached.token;

    const url =
      `${armEndpoint}/subscriptions/${options.subscriptionId}` +
      `/resourceGroups/${options.resourceGroup}` +
      `/providers/Microsoft.VideoIndexer/accounts/${options.accountName}` +
      `/generateAccessToken?api-version=${armApiVersion}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${await armToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ permissionType: 'Contributor', scope: 'Account' }),
    });
    if (!response.ok) {
      throw new VideoIndexerRequestError(
        `generateAccessToken responded ${String(response.status)}`,
        response.status,
      );
    }

    const { accessToken } = accessTokenSchema.parse(await response.json());
    cached = { token: accessToken, fetchedAt: now };
    return accessToken;
  }

  async function viFetch(
    method: 'GET' | 'POST',
    path: string,
    params: Record<string, string>,
  ): Promise<Response> {
    const url = new URL(`${apiEndpoint}/${options.location}/Accounts/${options.accountId}${path}`);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }
    const response = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${await accountToken()}` },
    });
    if (!response.ok) {
      throw new VideoIndexerRequestError(
        `Video Indexer ${method} ${path} responded ${String(response.status)}`,
        response.status,
      );
    }
    return response;
  }

  return {
    async submitVideo(request: SubmitVideoRequest): Promise<SubmittedVideo> {
      const response = await viFetch('POST', '/Videos', {
        name: request.name,
        videoUrl: request.videoUrl,
        callbackUrl: request.callbackUrl,
        externalId: request.externalId,
        privacy: 'Private',
        // No VI-side streaming renditions: we play the original blob (plan §4, ADR on ABR).
        streamingPreset: 'NoStreaming',
      });
      const submitted = submitResponseSchema.parse(await response.json());
      return { videoId: submitted.id, state: submitted.state };
    },

    async getIndex(videoId: string): Promise<unknown> {
      const response = await viFetch('GET', `/Videos/${videoId}/Index`, {});
      return response.json();
    },

    async getCaptions(videoId: string): Promise<string> {
      const response = await viFetch('GET', `/Videos/${videoId}/Captions`, { format: 'Vtt' });
      return response.text();
    },

    async getThumbnail(videoId: string, thumbnailId: string): Promise<Uint8Array> {
      const response = await viFetch('GET', `/Videos/${videoId}/Thumbnails/${thumbnailId}`, {
        format: 'Jpeg',
      });
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}
