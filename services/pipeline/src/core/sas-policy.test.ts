import { describe, expect, it } from 'vitest';

import {
  SAS_CLOCK_SKEW_MINUTES,
  VI_SOURCE_READ_SAS_HOURS,
  viSourceReadSasPolicy,
} from './sas-policy.js';

describe('viSourceReadSasPolicy', () => {
  const now = new Date('2026-08-12T10:00:00.000Z');

  it('grants read-only permission', () => {
    expect(viSourceReadSasPolicy(now).permissions).toBe('r');
  });

  it('backdates the start to absorb clock skew', () => {
    expect(viSourceReadSasPolicy(now).startsOn).toEqual(
      new Date(now.getTime() - SAS_CLOCK_SKEW_MINUTES * 60_000),
    );
  });

  it('expires after the VI source-read window', () => {
    expect(viSourceReadSasPolicy(now).expiresOn).toEqual(
      new Date(now.getTime() + VI_SOURCE_READ_SAS_HOURS * 3_600_000),
    );
  });
});
