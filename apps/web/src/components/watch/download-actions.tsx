'use client';

import { downloadResponseSchema } from '@vidx/shared';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { fetchApi, fetchApiFile, toApiRequestError } from '@/lib/api/client';

type DownloadKind = 'video' | 'vtt' | 'json';

const DOWNLOAD_PATHS: Record<DownloadKind, (id: string) => string> = {
  video: (id) => `/api/videos/${encodeURIComponent(id)}/download`,
  vtt: (id) => `/api/videos/${encodeURIComponent(id)}/download/transcript?format=vtt`,
  json: (id) => `/api/videos/${encodeURIComponent(id)}/download/transcript?format=json`,
};

/** Used only if the server's content-disposition filename goes missing. */
const FALLBACK_FILE_NAMES: Record<Exclude<DownloadKind, 'video'>, string> = {
  vtt: 'transcript.vtt',
  json: 'transcript.json',
};

/** Hands fetched bytes to the browser as a named file save. */
function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

interface DownloadActionsProps {
  videoId: string;
  /** Transcript downloads only make sense once a transcript exists. */
  hasTranscript: boolean;
}

/**
 * Downloads are open to every signed-in user (plan §4, round-3 decision). The video
 * endpoint returns a short-lived SAS URL to navigate to; the transcript endpoint
 * streams the file itself (text/vtt or a JSON line array, per the OpenAPI contract).
 */
export function DownloadActions({
  videoId,
  hasTranscript,
}: DownloadActionsProps): React.JSX.Element {
  const [busy, setBusy] = useState<DownloadKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = (kind: DownloadKind): void => {
    setBusy(kind);
    setError(null);
    const path = DOWNLOAD_PATHS[kind](videoId);
    const request =
      kind === 'video'
        ? fetchApi(path, downloadResponseSchema).then((data) => {
            window.location.assign(data.url);
          })
        : fetchApiFile(path).then((file) => {
            saveBlob(file.blob, file.fileName ?? FALLBACK_FILE_NAMES[kind]);
          });
    request
      .catch((cause: unknown) => {
        const requestError = toApiRequestError(cause);
        setError(
          requestError.trackingId === null
            ? requestError.message
            : `${requestError.message} (support ID ${requestError.trackingId})`,
        );
      })
      .finally(() => {
        setBusy(null);
      });
  };

  return (
    <section aria-label="Downloads">
      <h2 className="mb-2 font-mono text-xs font-medium tracking-widest text-fg-muted">
        DOWNLOADS
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={() => {
            download('video');
          }}
        >
          <Download aria-hidden />
          {busy === 'video' ? 'Preparing…' : 'Download video'}
        </Button>
        {hasTranscript && (
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={() => {
                download('vtt');
              }}
            >
              <FileText aria-hidden />
              {busy === 'vtt' ? 'Preparing…' : 'Subtitles (.vtt)'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={() => {
                download('json');
              }}
            >
              <FileText aria-hidden />
              {busy === 'json' ? 'Preparing…' : 'Transcript (.json)'}
            </Button>
          </>
        )}
      </div>
      {error !== null && (
        <p role="alert" className="mt-2 text-sm text-status-err">
          {error}
        </p>
      )}
    </section>
  );
}
