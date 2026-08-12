import { resolve } from 'node:path';

import { loadReplayBundle } from './bundle.js';
import { replayProcessResults } from './replay.js';

/**
 * `pnpm replay --bundle ./.diagnostics/<uploadId>` (plan §7): reproduce a production
 * run locally from a downloaded diagnostics bundle. Set a breakpoint anywhere in
 * src/app or src/core and run this under a debugger — the fakes serve the captured
 * VI payloads, so the execution is the production one.
 */
const args = process.argv.slice(2);
const flagIndex = args.indexOf('--bundle');
const bundleArg = flagIndex === -1 ? args[0] : args[flagIndex + 1];

if (bundleArg === undefined) {
  console.error('Usage: pnpm replay --bundle <diagnostics-bundle-dir>');
  process.exit(2);
}

// pnpm runs this script with the package as cwd; INIT_CWD is where the user invoked
// `pnpm replay`, so relative bundle paths behave as typed.
const bundleDir = resolve(process.env.INIT_CWD ?? process.cwd(), bundleArg);
const bundle = await loadReplayBundle(bundleDir);
const result = await replayProcessResults(bundle, new Date());

console.log(`Replayed ProcessVideoResults for upload ${bundle.document.id}\n`);
console.log(
  JSON.stringify(
    {
      document: {
        status: result.document?.status,
        error: result.document?.error,
        durationInSeconds: result.document?.durationInSeconds,
        keywords: result.document?.keywords,
        topics: result.document?.topics,
        transcriptLines: result.document?.transcript.length,
        chapters: result.document?.chapters.length,
        trackingIds: result.document?.trackingIds,
      },
      resultsBlobs: [...result.resultsBlobs.keys()],
      diagnosticsEntries: result.diagnosticsEntries,
      notifications: result.notifications.map((notification) => ({
        title: notification.embeds[0].title,
        attachment: notification.attachment?.fileName ?? null,
      })),
      logs: result.logs.map((entry) => `${entry.level}: ${entry.message}`),
    },
    null,
    2,
  ),
);
