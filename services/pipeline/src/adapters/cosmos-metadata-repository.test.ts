import { type Container } from '@azure/cosmos';
import { describe, expect, it } from 'vitest';

import { videoDocument } from '../../test-support/builders.js';
import { createCosmosMetadataRepository } from './cosmos-metadata-repository.js';

/**
 * SDK-shaped stub at the adapter boundary (docs/testing-principles.md: the Cosmos
 * emulator is optional/nightly; the adapter surface stays thin enough for this).
 */
function stubContainer(seed: Record<string, unknown>[] = []): {
  container: Container;
  store: Map<string, Record<string, unknown>>;
} {
  const store = new Map<string, Record<string, unknown>>(
    seed.map((doc) => [doc.id as string, doc]),
  );
  const container = {
    item: (id: string) => ({
      read: () => Promise.resolve({ resource: store.get(id) }),
    }),
    items: {
      query: (spec: { parameters: { name: string; value: string }[] }) => ({
        fetchAll: () =>
          Promise.resolve({
            resources: [...store.values()].filter(
              (doc) => doc.videoId === spec.parameters[0]?.value,
            ),
          }),
      }),
      upsert: (doc: Record<string, unknown>) => {
        store.set(doc.id as string, doc);
        return Promise.resolve({});
      },
    },
  } as unknown as Container;
  return { container, store };
}

describe('createCosmosMetadataRepository', () => {
  it('reads a document and strips Cosmos system fields via the schema', async () => {
    const { container } = stubContainer([
      { ...videoDocument(), _rid: 'rid==', _etag: '"x"', _ts: 1755000000 },
    ]);
    const repository = createCosmosMetadataRepository(container);

    const document = await repository.get('upl-0001');

    expect(document).toEqual(videoDocument());
    expect(document).not.toHaveProperty('_rid');
  });

  it('returns null when the item is missing', async () => {
    const repository = createCosmosMetadataRepository(stubContainer().container);
    expect(await repository.get('nope')).toBeNull();
  });

  it('returns null when the SDK throws a 404 instead', async () => {
    const container = {
      item: () => ({
        read: () => Promise.reject(Object.assign(new Error('NotFound'), { code: 404 })),
      }),
    } as unknown as Container;
    const repository = createCosmosMetadataRepository(container);

    expect(await repository.get('upl-0001')).toBeNull();
  });

  it('propagates non-404 errors', async () => {
    const container = {
      item: () => ({
        read: () => Promise.reject(Object.assign(new Error('Forbidden'), { code: 403 })),
      }),
    } as unknown as Container;
    const repository = createCosmosMetadataRepository(container);

    await expect(repository.get('upl-0001')).rejects.toThrow('Forbidden');
  });

  it('surfaces out-of-contract documents loudly instead of returning garbage', async () => {
    const { container } = stubContainer([{ id: 'upl-0001', totally: 'broken' }]);
    const repository = createCosmosMetadataRepository(container);

    await expect(repository.get('upl-0001')).rejects.toThrow();
  });

  it('finds a document by VI video id', async () => {
    const indexing = videoDocument({ status: 'Indexing', videoId: 'vi-123' });
    const { container } = stubContainer([indexing]);
    const repository = createCosmosMetadataRepository(container);

    expect(await repository.findByVideoId('vi-123')).toEqual(indexing);
    expect(await repository.findByVideoId('vi-999')).toBeNull();
  });

  it('validates before upserting', async () => {
    const { container, store } = stubContainer();
    const repository = createCosmosMetadataRepository(container);
    const document = videoDocument();

    await repository.upsert(document);
    expect(store.get('upl-0001')).toEqual(document);

    await expect(
      repository.upsert({ ...document, status: 'NotAStatus' } as unknown as typeof document),
    ).rejects.toThrow();
  });
});
