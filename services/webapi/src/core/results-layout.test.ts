import { describe, expect, it } from 'vitest';

import { captionsBlobName, resultsPrefix } from './results-layout.js';

describe('results layout', () => {
  it('matches the pipeline captions artifact location', () => {
    expect(captionsBlobName('upl-1')).toBe('upl-1/transcript.vtt');
  });

  it('scopes deletion to the video prefix', () => {
    expect(resultsPrefix('upl-1')).toBe('upl-1/');
  });
});
