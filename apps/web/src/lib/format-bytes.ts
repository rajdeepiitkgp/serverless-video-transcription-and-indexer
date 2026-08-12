const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Human file size for upload rows: `824 MB`, `1.9 GB`. Binary steps, one decimal. */
export function formatBytes(bytes: number): string {
  const safe = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  let value = safe;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rendered =
    unit === 0 || value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
  return `${rendered} ${UNITS[unit] ?? 'B'}`;
}
