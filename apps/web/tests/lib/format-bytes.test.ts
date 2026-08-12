import { describe, expect, it } from 'vitest';

import { formatBytes } from '@/lib/format-bytes';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [824 * 1024 ** 2, '824 MB'],
    [2 * 1024 ** 3, '2 GB'],
    [2.5 * 1024 ** 3, '2.5 GB'],
  ])('formats %d as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('never crashes on a non-finite size', () => {
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
