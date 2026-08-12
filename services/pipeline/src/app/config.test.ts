import { describe, expect, it } from 'vitest';

import { loadPipelineConfig } from './config.js';

const validEnv = {
  STORAGE_BLOB_ENDPOINT: 'https://vidxsa.blob.core.windows.net',
  COSMOS_ENDPOINT: 'https://vidx-cosmos.documents.azure.com',
  EVENT_GRID_TOPIC_ENDPOINT: 'https://vidx-topic.eastus-1.eventgrid.azure.net/api/events',
  VI_SUBSCRIPTION_ID: 'sub-1',
  VI_RESOURCE_GROUP: 'rg-vidx-prod',
  VI_ACCOUNT_NAME: 'vidx-vi',
  VI_ACCOUNT_ID: 'acc-guid-1',
  VI_LOCATION: 'eastus',
  VI_CALLBACK_URL: 'https://vidx-pipeline.azurewebsites.net/api/indexing-callback?code=key',
  DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/token',
};

describe('loadPipelineConfig', () => {
  it('parses a complete environment and applies container/database defaults', () => {
    const config = loadPipelineConfig(validEnv);
    expect(config.VIDEOS_CONTAINER).toBe('videos');
    expect(config.RESULTS_CONTAINER).toBe('results');
    expect(config.COSMOS_DATABASE).toBe('VideoAnalytics');
    expect(config.COSMOS_CONTAINER).toBe('VideoMetadata');
    expect(config.WEB_BASE_URL).toBeUndefined();
  });

  it('keeps explicit overrides', () => {
    const config = loadPipelineConfig({
      ...validEnv,
      VIDEOS_CONTAINER: 'uploads',
      WEB_BASE_URL: 'https://vidx.example.com',
      VI_ARM_API_VERSION: '2025-06-01',
    });
    expect(config.VIDEOS_CONTAINER).toBe('uploads');
    expect(config.WEB_BASE_URL).toBe('https://vidx.example.com');
    expect(config.VI_ARM_API_VERSION).toBe('2025-06-01');
  });

  it('fails loudly when a required setting is missing', () => {
    const incomplete: Record<string, string | undefined> = { ...validEnv };
    delete incomplete.DISCORD_WEBHOOK_URL;
    expect(() => loadPipelineConfig(incomplete)).toThrow();
  });

  it('rejects non-URL endpoints', () => {
    expect(() => loadPipelineConfig({ ...validEnv, STORAGE_BLOB_ENDPOINT: 'not a url' })).toThrow();
  });

  it('ignores unrelated environment variables', () => {
    const config = loadPipelineConfig({ ...validEnv, PATH: '/usr/bin', HOME: '/home/x' });
    expect(config).not.toHaveProperty('PATH');
  });
});
