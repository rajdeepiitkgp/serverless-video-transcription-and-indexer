import { type VideoStatus } from '@vidx/shared';

import { StatusChip } from '@/components/video/status-chip';
import { cn } from '@/lib/cn';

export type StatusCounts = Record<VideoStatus, number>;

const STRIP_CELLS = 40;

/** Fixed stage order — position is the secondary encoding beside the legend. */
const STATUS_ORDER: readonly VideoStatus[] = ['Uploaded', 'Indexing', 'Processed', 'Failed'];

const CELL_STYLES: Record<VideoStatus, string> = {
  Uploaded: 'bg-status-idle',
  Indexing: 'bg-status-busy',
  Processed: 'bg-status-ok',
  Failed: 'bg-status-err',
};

/**
 * Largest-remainder apportionment of the strip's cells, with a floor: any status
 * that exists at all keeps at least one lit cell (rounding must never hide a
 * failure). Exported for tests.
 */
export function statusCellCounts(counts: StatusCounts, cells: number = STRIP_CELLS): StatusCounts {
  const total = STATUS_ORDER.reduce((sum, status) => sum + counts[status], 0);
  const result: StatusCounts = { Uploaded: 0, Indexing: 0, Processed: 0, Failed: 0 };
  if (total === 0) {
    return result;
  }

  const remainders: { status: VideoStatus; remainder: number }[] = [];
  let assigned = 0;
  for (const status of STATUS_ORDER) {
    const exact = (counts[status] * cells) / total;
    result[status] = Math.floor(exact);
    assigned += result[status];
    remainders.push({ status, remainder: exact - result[status] });
  }
  remainders.sort((a, b) => b.remainder - a.remainder);
  for (let index = 0; assigned < cells; index += 1) {
    const next = remainders[index % remainders.length];
    if (next !== undefined) {
      result[next.status] += 1;
      assigned += 1;
    }
  }

  // Floor pass: steal from the largest block for any present-but-rounded-out status.
  for (const status of STATUS_ORDER) {
    if (counts[status] > 0 && result[status] === 0) {
      const largest = [...STATUS_ORDER].sort((a, b) => result[b] - result[a])[0];
      if (largest !== undefined && result[largest] > 1) {
        result[largest] -= 1;
        result[status] += 1;
      }
    }
  }
  return result;
}

/**
 * The pipeline strip: the library's status mix as a run of discrete VU cells in
 * fixed stage order. The legend of chips + counts carries the identity and the
 * numbers; the strip itself is the at-a-glance shape, hidden from the
 * accessibility tree.
 */
export function StatusStrip({
  counts,
  className,
}: {
  counts: StatusCounts;
  className?: string;
}): React.JSX.Element {
  const cells = statusCellCounts(counts);
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div aria-hidden className="flex gap-0.5">
        {STATUS_ORDER.flatMap((status) =>
          Array.from({ length: cells[status] }, (_, index) => (
            <span
              key={`${status}-${String(index)}`}
              className={cn('h-3 w-1.5 rounded-xs', CELL_STYLES[status])}
            />
          )),
        )}
        {STATUS_ORDER.every((status) => cells[status] === 0) &&
          Array.from({ length: STRIP_CELLS }, (_, index) => (
            <span key={index} className="h-3 w-1.5 rounded-xs bg-line" />
          ))}
      </div>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {STATUS_ORDER.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <StatusChip status={status} />
            <span className="font-mono text-xs text-fg-muted">{counts[status]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
