import { type Container } from '@azure/cosmos';
import { describe, expect, it } from 'vitest';

import { createCosmosVideoRepository } from '../../src/adapters/cosmos-video-repository.js';
import { videoDocument } from '../support/builders.js';

interface QuerySpec {
  query: string;
  parameters?: { name: string; value: string }[];
}

/**
 * SDK-shaped stub at the adapter boundary (docs/testing-principles.md: the Cosmos
 * emulator is optional/nightly; the adapter surface stays thin enough for this).
 * Queries return everything seeded — the SQL itself is pinned by assertion, not
 * emulated.
 */
function stubContainer(seed: Record<string, unknown>[] = []): {
  container: Container;
  store: Map<string, Record<string, unknown>>;
  queries: QuerySpec[];
  deleted: string[];
} {
  const store = new Map<string, Record<string, unknown>>(
    seed.map((doc) => [doc.id as string, doc]),
  );
  const queries: QuerySpec[] = [];
  const deleted: string[] = [];
  const container = {
    item: (id: string) => ({
      read: () => Promise.resolve({ resource: store.get(id) }),
      delete: () => {
        if (!store.has(id)) {
          return Promise.reject(Object.assign(new Error('NotFound'), { code: 404 }));
        }
        store.delete(id);
        deleted.push(id);
        return Promise.resolve({});
      },
    }),
    items: {
      query: (spec: QuerySpec) => {
        queries.push(spec);
        return { fetchAll: () => Promise.resolve({ resources: [...store.values()] }) };
      },
      upsert: (doc: Record<string, unknown>) => {
        store.set(doc.id as string, doc);
        return Promise.resolve({});
      },
    },
  } as unknown as Container;
  return { container, store, queries, deleted };
}

describe('createCosmosVideoRepository', () => {
  it('reads a document and strips Cosmos system fields via the schema', async () => {
    const { container } = stubContainer([
      { ...videoDocument(), _rid: 'rid==', _etag: '"x"', _ts: 1755000000 },
    ]);

    const document = await createCosmosVideoRepository(container).get('upl-0001');

    expect(document).toEqual(videoDocument());
    expect(document).not.toHaveProperty('_rid');
  });

  it('returns null for a missing document', async () => {
    expect(await createCosmosVideoRepository(stubContainer().container).get('nope')).toBeNull();
  });

  it('returns null when the SDK throws a 404 instead', async () => {
    const container = {
      item: () => ({
        read: () => Promise.reject(Object.assign(new Error('NotFound'), { code: 404 })),
      }),
    } as unknown as Container;

    expect(await createCosmosVideoRepository(container).get('upl-0001')).toBeNull();
  });

  it('propagates non-404 read errors', async () => {
    const container = {
      item: () => ({
        read: () => Promise.reject(Object.assign(new Error('Forbidden'), { code: 403 })),
      }),
    } as unknown as Container;

    await expect(createCosmosVideoRepository(container).get('upl-0001')).rejects.toThrow(
      'Forbidden',
    );
  });

  it('lists with the _ts-descending query and parses every document', async () => {
    const { container, queries } = stubContainer([videoDocument()]);

    const documents = await createCosmosVideoRepository(container).list();

    expect(documents).toEqual([videoDocument()]);
    expect(queries[0]?.query).toBe('SELECT * FROM c ORDER BY c._ts DESC');
  });

  it('surfaces out-of-contract documents loudly instead of returning garbage', async () => {
    const { container } = stubContainer([{ id: 'upl-0001', schemaVersion: 999 }]);

    await expect(createCosmosVideoRepository(container).list()).rejects.toThrow();
  });

  it('parses documents on create so an invalid write never reaches Cosmos', async () => {
    const { container, store } = stubContainer();

    await createCosmosVideoRepository(container).create(videoDocument());

    expect(store.get('upl-0001')).toEqual(videoDocument());
  });

  it('searches with a parameterized contains-prefilter over all four fields', async () => {
    const { container, queries } = stubContainer([videoDocument()]);

    await createCosmosVideoRepository(container).search('azure');

    const spec = queries[0];
    expect(spec?.parameters).toEqual([{ name: '@term', value: 'azure' }]);
    expect(spec?.query).toContain('CONTAINS(c.name, @term, true)');
    expect(spec?.query).toContain('k IN c.keywords WHERE CONTAINS(k, @term, true)');
    expect(spec?.query).toContain('t IN c.topics WHERE CONTAINS(t, @term, true)');
    expect(spec?.query).toContain('l IN c.transcript WHERE CONTAINS(l.text, @term, true)');
  });

  it('deletes an existing document', async () => {
    const { container, deleted } = stubContainer([videoDocument()]);

    await createCosmosVideoRepository(container).delete('upl-0001');

    expect(deleted).toEqual(['upl-0001']);
  });

  it('treats deleting a missing document as a no-op', async () => {
    await expect(
      createCosmosVideoRepository(stubContainer().container).delete('nope'),
    ).resolves.toBeUndefined();
  });

  it('propagates non-404 delete errors', async () => {
    const container = {
      item: () => ({
        delete: () => Promise.reject(Object.assign(new Error('Forbidden'), { code: 403 })),
      }),
    } as unknown as Container;

    await expect(createCosmosVideoRepository(container).delete('upl-0001')).rejects.toThrow(
      'Forbidden',
    );
  });
});
