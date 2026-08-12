import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type VideoDocument,
  videoDocumentSchema,
  type VideoIndexingCompletedEvent,
  videoIndexingCompletedEventSchema,
} from '@vidx/shared';

import { DIAGNOSTIC_ENTRIES } from '../core/results-layout.js';

/**
 * A diagnostics bundle on disk (plan §7): the folder `pnpm diagnostics` downloads —
 * `document.json` (the Cosmos document) next to the `process-results/…` diagnostics
 * captured in the results container. The same format the pipeline writes, tests
 * consume, and `pnpm replay` runs.
 */
export interface ReplayBundle {
  document: VideoDocument;
  /** The captured triggering event; replay synthesizes one when it's missing. */
  event: VideoIndexingCompletedEvent | null;
  viIndex: unknown;
  viCaptions: string | null;
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function loadReplayBundle(bundleDir: string): Promise<ReplayBundle> {
  const document = videoDocumentSchema.parse(
    JSON.parse(await readFile(join(bundleDir, 'document.json'), 'utf8')),
  );

  const rawIndex = await readOptional(join(bundleDir, DIAGNOSTIC_ENTRIES.processResults.viIndex));
  if (rawIndex === null) {
    throw new Error(
      `Bundle has no ${DIAGNOSTIC_ENTRIES.processResults.viIndex} — nothing to replay`,
    );
  }

  const rawEvent = await readOptional(join(bundleDir, DIAGNOSTIC_ENTRIES.processResults.event));
  const viCaptions = await readOptional(
    join(bundleDir, DIAGNOSTIC_ENTRIES.processResults.viCaptions),
  );

  return {
    document,
    event: rawEvent === null ? null : videoIndexingCompletedEventSchema.parse(JSON.parse(rawEvent)),
    viIndex: JSON.parse(rawIndex) as unknown,
    viCaptions,
  };
}
