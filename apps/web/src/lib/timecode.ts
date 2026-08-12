const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Formats fractional seconds as an edit-deck timecode (`00:04:12`). Hours widen past
 * two digits rather than wrapping. Non-finite input renders as zero so a missing
 * duration can never crash a page.
 */
export function formatTimecode(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Formats fractional seconds as a WebVTT cue timestamp (`00:04:12.500`). */
export function formatVttTimestamp(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  // Round to whole milliseconds first so 1.9995s becomes 00:00:02.000, not …:01.1000.
  const totalMillis = Math.round(safe * 1000);
  const millis = totalMillis % 1000;
  return `${formatTimecode(Math.floor(totalMillis / 1000))}.${String(millis).padStart(3, '0')}`;
}
