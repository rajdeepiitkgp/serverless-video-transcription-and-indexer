import { describe, expect, it } from 'vitest';

import { parseCallbackQuery } from '../../src/core/callback.js';

describe('parseCallbackQuery', () => {
  it('parses a terminal Processed callback', () => {
    expect(parseCallbackQuery({ id: 'vi-123', state: 'Processed' })).toEqual({
      videoId: 'vi-123',
      state: 'Processed',
    });
  });

  it('parses a terminal Failed callback', () => {
    expect(parseCallbackQuery({ id: 'vi-123', state: 'Failed' })).toEqual({
      videoId: 'vi-123',
      state: 'Failed',
    });
  });

  it('round-trips the uploadId we appended to the callback URL', () => {
    expect(parseCallbackQuery({ id: 'vi-123', state: 'Processed', uploadId: 'upl-1' })).toEqual({
      videoId: 'vi-123',
      state: 'Processed',
      uploadId: 'upl-1',
    });
  });

  it('omits a blank uploadId', () => {
    expect(parseCallbackQuery({ id: 'vi-123', state: 'Processed', uploadId: '  ' })).toEqual({
      videoId: 'vi-123',
      state: 'Processed',
    });
  });

  it('ignores non-terminal progress callbacks', () => {
    expect(parseCallbackQuery({ id: 'vi-123', state: 'Processing' })).toBeNull();
    expect(parseCallbackQuery({ id: 'vi-123', state: 'Uploaded' })).toBeNull();
  });

  it('ignores callbacks with no usable video id or state', () => {
    expect(parseCallbackQuery({ state: 'Processed' })).toBeNull();
    expect(parseCallbackQuery({ id: '   ', state: 'Processed' })).toBeNull();
    expect(parseCallbackQuery({ id: 'vi-123' })).toBeNull();
  });
});
