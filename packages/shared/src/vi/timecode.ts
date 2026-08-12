/**
 * Video Indexer timecodes are `H:MM:SS` with optional fractional seconds
 * (e.g. `0:00:01.2`, `1:02:03.45`, `0:00:05.1400000`). Hours may exceed one digit.
 */
const TIMECODE_PATTERN = /^(\d+):([0-5]\d):([0-5]\d(?:\.\d+)?)$/;

/** Converts a Video Indexer timecode string into fractional seconds. */
export function parseTimecode(timecode: string): number {
  const match = TIMECODE_PATTERN.exec(timecode);
  if (match === null) {
    throw new Error(`Invalid Video Indexer timecode: "${timecode}"`);
  }
  return match
    .slice(1)
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}
