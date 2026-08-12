import { describe, expect, it } from 'vitest';

import { formatTimecode, formatVttTimestamp } from '@/lib/timecode';

describe('formatTimecode', () => {
  it('formats zero', () => {
    expect(formatTimecode(0)).toBe('00:00:00');
  });

  it('formats minutes and seconds', () => {
    expect(formatTimecode(61)).toBe('00:01:01');
  });

  it('formats hours', () => {
    expect(formatTimecode(3661)).toBe('01:01:01');
  });

  it('widens past two hour digits instead of wrapping', () => {
    expect(formatTimecode(360_000)).toBe('100:00:00');
  });

  it('floors fractional seconds', () => {
    expect(formatTimecode(4.9)).toBe('00:00:04');
  });

  it('clamps negative input to zero', () => {
    expect(formatTimecode(-5)).toBe('00:00:00');
  });

  it('renders non-finite input as zero', () => {
    expect(formatTimecode(Number.NaN)).toBe('00:00:00');
    expect(formatTimecode(Number.POSITIVE_INFINITY)).toBe('00:00:00');
  });
});

describe('formatVttTimestamp', () => {
  it('formats whole seconds with zero millis', () => {
    expect(formatVttTimestamp(4)).toBe('00:00:04.000');
  });

  it('formats fractional seconds', () => {
    expect(formatVttTimestamp(4.5)).toBe('00:00:04.500');
  });

  it('carries millisecond rounding into the seconds field', () => {
    expect(formatVttTimestamp(1.9995)).toBe('00:00:02.000');
  });

  it('renders non-finite input as zero', () => {
    expect(formatVttTimestamp(Number.NaN)).toBe('00:00:00.000');
  });
});
