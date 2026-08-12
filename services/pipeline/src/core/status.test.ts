import { describe, expect, it } from 'vitest';

import { assertTransition, canTransition, isTerminal } from './status.js';

describe('status state machine', () => {
  it.each([
    ['Uploaded', 'Indexing'],
    ['Uploaded', 'Failed'],
    ['Indexing', 'Processed'],
    ['Indexing', 'Failed'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['Uploaded', 'Processed'],
    ['Indexing', 'Uploaded'],
    ['Processed', 'Failed'],
    ['Processed', 'Indexing'],
    ['Failed', 'Processed'],
    ['Failed', 'Indexing'],
  ] as const)('rejects %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('treats Processed and Failed as terminal, the rest as live', () => {
    expect(isTerminal('Processed')).toBe(true);
    expect(isTerminal('Failed')).toBe(true);
    expect(isTerminal('Uploaded')).toBe(false);
    expect(isTerminal('Indexing')).toBe(false);
  });

  it('assertTransition passes valid moves and throws on invalid ones', () => {
    expect(() => {
      assertTransition('Indexing', 'Processed');
    }).not.toThrow();
    expect(() => {
      assertTransition('Processed', 'Failed');
    }).toThrow('Invalid status transition: Processed → Failed');
  });
});
