import { describe, expect, it } from 'vitest';

import {
  downloadReadSasPolicy,
  playbackReadSasPolicy,
  uploadWriteSasPolicy,
} from '../../src/core/sas-policy.js';

const NOW = new Date('2026-08-12T10:00:00.000Z');

describe('uploadWriteSasPolicy', () => {
  it('grants create+write for 15 minutes, backdated for clock skew', () => {
    expect(uploadWriteSasPolicy(NOW)).toEqual({
      permissions: 'cw',
      startsOn: new Date('2026-08-12T09:55:00.000Z'),
      expiresOn: new Date('2026-08-12T10:15:00.000Z'),
    });
  });
});

describe('playbackReadSasPolicy', () => {
  it('grants read for one hour, backdated for clock skew', () => {
    expect(playbackReadSasPolicy(NOW)).toEqual({
      permissions: 'r',
      startsOn: new Date('2026-08-12T09:55:00.000Z'),
      expiresOn: new Date('2026-08-12T11:00:00.000Z'),
    });
  });
});

describe('downloadReadSasPolicy', () => {
  it('grants read for 15 minutes, backdated for clock skew', () => {
    expect(downloadReadSasPolicy(NOW)).toEqual({
      permissions: 'r',
      startsOn: new Date('2026-08-12T09:55:00.000Z'),
      expiresOn: new Date('2026-08-12T10:15:00.000Z'),
    });
  });
});
