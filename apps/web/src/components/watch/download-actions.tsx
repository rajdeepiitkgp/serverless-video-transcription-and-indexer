'use client';

import { downloadResponseSchema } from '@vidx/shared';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { fetchApi, toApiRequestError } from '@/lib/api/client';

type DownloadKind = 'video' | 'vtt' | 'json';

const DOWNLOAD_PATHS: Record<DownloadKind, (id: string) => string> = {
  video: (id) => `/api/videos/${encodeURIComponent(id)}/download`,
  vtt: (id) => `/api/videos/${encodeURIComponent(id)}/download/transcript?format=vtt`,
  json: (id) => `/api/videos/${encodeURIComponent(id)}/download/transcript?format=json`,
};

interface DownloadActionsProps {
  videoId: string;
  /** Transcript downloads only make sense once a transcript exists. */
  hasTranscript: boolean;
}

/**
 * Downloads are open to every signed-in user (plan §4, round-3 decision). The API
 * returns a short-lived SAS URL; navigating to it triggers the browser download.
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
    fetchApi(DOWNLOAD_PATHS[kind](videoId), downloadResponseSchema)
      .then((data) => {
        window.location.assign(data.url);
      })
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
