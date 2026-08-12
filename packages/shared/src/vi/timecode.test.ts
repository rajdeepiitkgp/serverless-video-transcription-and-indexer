import { describe, expect, it } from 'vitest';

import { parseTimecode } from './timecode.js';

describe('parseTimecode', () => {
  it.each([
    ['0:00:00', 0],
    ['0:00:01.2', 1.2],
    ['0:00:05.14', 5.14],
    ['0:01:04.5', 64.5],
    ['0:02:07.04', 127.04],
    ['0:59:59.999', 3599.999],
    ['1:02:03.45', 3723.45],
    ['12:00:00', 43200],
    ['0:00:05.1400000', 5.14],
  ])('parses VI timecode %s to %d seconds', (timecode, seconds) => {
    expect(parseTimecode(timecode)).toBeCloseTo(seconds, 6);
  });

  it.each([
    '',
    'abc',
    '1:2:3', // minutes and seconds must be two digits
    '0:60:00', // minutes out of range
    '0:00:61', // seconds out of range
    '-0:00:01',
    '0:00:01,5', // comma is not a decimal separator
    '00:00', // missing hours segment
    '0:00:01.2s',
  ])('throws on invalid timecode %j', (timecode) => {
    expect(() => parseTimecode(timecode)).toThrow(/timecode/i);
  });
});
