import { type VideoStatus } from '@vidx/shared';

/**
 * The pipeline status state machine (plan §5): Uploaded → Indexing → Processed,
 * with Failed reachable from both non-terminal states. Event Grid delivers
 * at-least-once, so handlers use these guards to make redeliveries no-ops.
 */
const TRANSITIONS: Readonly<Record<VideoStatus, readonly VideoStatus[]>> = {
  Uploaded: ['Indexing', 'Failed'],
  Indexing: ['Processed', 'Failed'],
  Processed: [],
  Failed: [],
};

export function canTransition(from: VideoStatus, to: VideoStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: VideoStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Guards impossible transitions — reaching one means a handler skipped its idempotency check. */
export function assertTransition(from: VideoStatus, to: VideoStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}`);
  }
}
