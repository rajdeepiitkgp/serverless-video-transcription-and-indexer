'use client';

import {
  deleteResponseSchema,
  MAX_UPLOAD_BYTES,
  type UploadResponse,
  uploadResponseSchema,
} from '@vidx/shared';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { describeApiError, fetchApi } from '@/lib/api/client';
import { type UploadTransport, xhrUploadTransport } from '@/lib/uploads/put-blob';
import { useVideosLive } from '@/lib/videos/videos-live';

export type UploadPhase =
  /** POST /api/uploads in flight — the document + write SAS are being issued. */
  | 'requesting'
  /** Server said `playable: false`; waiting on the user's warning decision. */
  | 'awaiting-confirmation'
  | 'uploading'
  | 'done'
  | 'failed';

export interface UploadItem {
  /** Local list key — the server's uploadId only exists after the POST returns. */
  key: string;
  uploadId: string | null;
  fileName: string;
  sizeBytes: number;
  /** 0..1 while uploading. */
  progress: number;
  phase: UploadPhase;
  error: string | null;
}

export interface UploadsApi {
  uploads: UploadItem[];
  startUpload: (file: File) => void;
  /** Proceed with a non-playable format after the warning (plan §4). */
  confirmUpload: (key: string) => void;
  /** Abandon a warned upload: deletes the just-created `Uploaded` document. */
  cancelUpload: (key: string) => void;
  /** Clear a finished or failed row from the list. */
  dismissUpload: (key: string) => void;
}

const UploadsContext = createContext<UploadsApi | null>(null);

const formatGiB = (bytes: number): string => `${String(Math.round(bytes / 1024 ** 3))} GiB`;

/**
 * Browser-side upload pipeline (plan §2 flow note 1): POST /api/uploads issues an
 * `Uploaded` document plus a 15-minute write-only SAS, then the browser PUTs the
 * bytes straight to Blob Storage. Lives at the app root so uploads survive
 * navigation, and the dashboard's live progress bars can watch them from anywhere.
 */
export function UploadsProvider({
  children,
  transport = xhrUploadTransport,
}: {
  children: ReactNode;
  transport?: UploadTransport;
}): React.JSX.Element {
  const { refetch } = useVideosLive();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  // The File handle and SAS URL never render; parking them off-state avoids
  // rebuilding the list on every progress tick for data nothing displays.
  const pending = useRef(new Map<string, { file: File; uploadUrl: string }>());

  const patchItem = useCallback((key: string, patch: Partial<UploadItem>): void => {
    setUploads((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const beginPut = useCallback(
    (key: string): void => {
      const parked = pending.current.get(key);
      if (parked === undefined) {
        return;
      }
      patchItem(key, { phase: 'uploading' });
      toast(`Upload started — ${parked.file.name}`);
      let lastReported = 0;
      transport
        .put(parked.uploadUrl, parked.file, (fraction) => {
          // Progress events arrive far faster than the waveform can show them.
          if (fraction - lastReported >= 0.01 || fraction === 1) {
            lastReported = fraction;
            patchItem(key, { progress: fraction });
          }
        })
        .then(() => {
          patchItem(key, { phase: 'done', progress: 1 });
          toast.success(`Upload complete — ${parked.file.name}`, {
            description: 'Indexing starts automatically.',
          });
          refetch();
        })
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : 'The upload failed.';
          patchItem(key, { phase: 'failed', error: message });
          toast.error(`Upload failed — ${parked.file.name}`, { description: message });
        })
        .finally(() => {
          pending.current.delete(key);
        });
    },
    [patchItem, refetch, transport],
  );

  const startUpload = useCallback(
    (file: File): void => {
      const key = crypto.randomUUID();
      const base: UploadItem = {
        key,
        uploadId: null,
        fileName: file.name,
        sizeBytes: file.size,
        progress: 0,
        phase: 'requesting',
        error: null,
      };

      if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
        const error =
          file.size === 0
            ? 'The file is empty.'
            : `The file is larger than the ${formatGiB(MAX_UPLOAD_BYTES)} upload limit.`;
        setUploads((items) => [{ ...base, phase: 'failed', error }, ...items]);
        toast.error(`Upload failed — ${file.name}`, { description: error });
        return;
      }

      setUploads((items) => [base, ...items]);
      fetchApi('/api/uploads', uploadResponseSchema, {
        method: 'POST',
        body: {
          fileName: file.name,
          contentType: file.type === '' ? 'application/octet-stream' : file.type,
          sizeBytes: file.size,
        },
      })
        .then((response: UploadResponse) => {
          pending.current.set(key, { file, uploadUrl: response.uploadUrl });
          patchItem(key, { uploadId: response.uploadId });
          if (response.playable) {
            beginPut(key);
          } else {
            patchItem(key, { phase: 'awaiting-confirmation' });
          }
        })
        .catch((cause: unknown) => {
          const message = describeApiError(cause);
          patchItem(key, { phase: 'failed', error: message });
          toast.error(`Upload failed — ${file.name}`, { description: message });
        });
    },
    [beginPut, patchItem],
  );

  const cancelUpload = useCallback(
    (key: string): void => {
      const item = uploads.find((candidate) => candidate.key === key);
      pending.current.delete(key);
      setUploads((items) => items.filter((candidate) => candidate.key !== key));
      if (item?.uploadId == null) {
        return;
      }
      // The POST already wrote an `Uploaded` document; deleting it keeps the
      // library free of rows that will never index (no blob ever arrives).
      fetchApi(`/api/videos/${encodeURIComponent(item.uploadId)}`, deleteResponseSchema, {
        method: 'DELETE',
      })
        .then(() => {
          toast(`Upload canceled — ${item.fileName}`);
          refetch();
        })
        .catch((cause: unknown) => {
          toast.error(`Couldn't clean up ${item.fileName}`, {
            description: describeApiError(cause),
          });
        });
    },
    [refetch, uploads],
  );

  const dismissUpload = useCallback((key: string): void => {
    setUploads((items) =>
      items.filter(
        (item) => item.key !== key || (item.phase !== 'done' && item.phase !== 'failed'),
      ),
    );
  }, []);

  const active = uploads.some((item) => item.phase === 'requesting' || item.phase === 'uploading');
  useEffect(() => {
    if (!active) {
      return;
    }
    // Closing the tab mid-PUT abandons the upload; give the browser's native
    // "leave site?" prompt a chance to save it.
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [active]);

  return (
    <UploadsContext.Provider
      value={{ uploads, startUpload, confirmUpload: beginPut, cancelUpload, dismissUpload }}
    >
      {children}
    </UploadsContext.Provider>
  );
}

export function useUploads(): UploadsApi {
  const context = useContext(UploadsContext);
  if (context === null) {
    throw new Error('useUploads requires an UploadsProvider ancestor.');
  }
  return context;
}
