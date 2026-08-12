import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import {
  createTrackingId,
  envelope,
  errorEnvelopeSchema,
  trackingIdSchema,
} from '../../src/contracts/envelope.js';

describe('trackingIdSchema', () => {
  it.each(['VXT-a1b2c3d4', 'VXT-00000000', 'VXT-deadbeef'])('accepts %s', (id) => {
    expect(trackingIdSchema.parse(id)).toBe(id);
  });

  it.each([
    'VXT-A1B2C3D4', // uppercase hex not allowed — IDs are quoted verbatim by users
    'VXT-a1b2c3', // too short
    'VXT-a1b2c3d4e5', // too long
    'vxt-a1b2c3d4',
    'a1b2c3d4',
    '',
  ])('rejects %j', (id) => {
    expect(trackingIdSchema.safeParse(id).success).toBe(false);
  });
});

describe('createTrackingId', () => {
  it('generates ids matching the contract', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(trackingIdSchema.safeParse(createTrackingId()).success).toBe(true);
    }
  });

  it('generates distinct ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createTrackingId()));
    expect(ids.size).toBeGreaterThan(90);
  });
});

describe('envelopes', () => {
  it('wraps success payloads under data', () => {
    const schema = envelope(z.object({ ok: z.boolean() }));
    expect(schema.parse({ data: { ok: true } })).toEqual({ data: { ok: true } });
    expect(schema.safeParse({ ok: true }).success).toBe(false);
  });

  it('requires a trackingId on every error', () => {
    const error = {
      error: { code: 'NotFound', message: 'Video not found', trackingId: 'VXT-a1b2c3d4' },
    };
    expect(errorEnvelopeSchema.parse(error)).toEqual(error);

    const withoutTracking = {
      error: { code: 'NotFound', message: 'Video not found' },
    };
    expect(errorEnvelopeSchema.safeParse(withoutTracking).success).toBe(false);
  });
});
