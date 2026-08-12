import { describe, expect, it } from 'vitest';

import { loadWebApiConfig } from './config.js';

const required = {
  STORAGE_BLOB_ENDPOINT: 'https://account.blob.core.windows.net',
  COSMOS_ENDPOINT: 'https://account.documents.azure.com',
};

describe('loadWebApiConfig', () => {
  it('applies defaults for optional settings', () => {
    expect(loadWebApiConfig(required)).toEqual({
      STORAGE_BLOB_ENDPOINT: 'https://account.blob.core.windows.net',
      VIDEOS_CONTAINER: 'videos',
      RESULTS_CONTAINER: 'results',
      COSMOS_ENDPOINT: 'https://account.documents.azure.com',
      COSMOS_DATABASE: 'VideoAnalytics',
      COSMOS_CONTAINER: 'VideoMetadata',
      HEALTH_PROBE_TIMEOUT_MS: 2000,
    });
  });

  it('coerces the numeric probe timeout from the app-setting string', () => {
    expect(
      loadWebApiConfig({ ...required, HEALTH_PROBE_TIMEOUT_MS: '500' }).HEALTH_PROBE_TIMEOUT_MS,
    ).toBe(500);
  });

  it('fails loudly on a missing endpoint', () => {
    expect(() => loadWebApiConfig({ COSMOS_ENDPOINT: required.COSMOS_ENDPOINT })).toThrow();
  });

  it('fails loudly on a malformed endpoint', () => {
    expect(() => loadWebApiConfig({ ...required, COSMOS_ENDPOINT: 'not-a-url' })).toThrow();
  });
});
