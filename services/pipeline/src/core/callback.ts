import { type VideoIndexingCompletedEventData, videoIndexingStateSchema } from '@vidx/shared';

/**
 * Interprets the Video Indexer callback query (`?id=…&state=…` plus the `uploadId`
 * we appended to the callback URL at submission). Returns the event payload to
 * republish, or null for anything non-terminal or malformed — the callback is
 * untrusted input (plan §2 flow note 4), so unusable requests are ignored, never
 * acted on.
 */
export function parseCallbackQuery(
  query: Readonly<Record<string, string | undefined>>,
): VideoIndexingCompletedEventData | null {
  const videoId = query.id?.trim();
  if (videoId === undefined || videoId === '') return null;

  const state = videoIndexingStateSchema.safeParse(query.state);
  if (!state.success) return null;

  const uploadId = query.uploadId?.trim();
  return {
    videoId,
    state: state.data,
    ...(uploadId !== undefined && uploadId !== '' ? { uploadId } : {}),
  };
}
