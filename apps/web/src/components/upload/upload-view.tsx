'use client';

import { UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { Section } from '@/components/layout/section';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { WaveformProgress } from '@/components/upload/waveform-progress';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format-bytes';
import { type UploadItem, useUploads } from '@/lib/uploads/uploads-provider';

/**
 * Picker hint only — the upload policy in the webapi is the authority on formats,
 * and it warns rather than rejects for non-playable ones (plan §4).
 */
const ACCEPT = 'video/*,.3gp,.3gpp,.asf,.avi,.flv,.gxf,.mkv,.mov,.mpg,.mpeg,.mxf,.ts,.wmv';

function UploadRow({
  upload,
  onDismiss,
}: {
  upload: UploadItem;
  onDismiss: (key: string) => void;
}): React.JSX.Element {
  const dismissible = upload.phase === 'done' || upload.phase === 'failed';
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-md border bg-surface px-4 py-3',
        upload.phase === 'failed' ? 'border-status-err/40' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{upload.fileName}</p>
          <p className="mt-0.5 font-mono text-xs text-fg-faint">{formatBytes(upload.sizeBytes)}</p>
        </div>
        {dismissible && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Clear ${upload.fileName} from the list`}
            onClick={() => {
              onDismiss(upload.key);
            }}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>

      {upload.phase === 'requesting' && (
        <p className="font-mono text-xs text-fg-muted">REQUESTING UPLOAD SLOT…</p>
      )}
      {upload.phase === 'awaiting-confirmation' && (
        <p className="font-mono text-xs text-status-busy">WAITING FOR YOUR DECISION</p>
      )}
      {upload.phase === 'uploading' && (
        <div className="flex items-center gap-3">
          <WaveformProgress
            fraction={upload.progress}
            label={`Upload progress for ${upload.fileName}`}
          />
          <span className="font-mono text-xs text-accent">
            {Math.round(upload.progress * 100)}%
          </span>
        </div>
      )}
      {upload.phase === 'done' && (
        <p className="font-mono text-xs text-status-ok">UPLOADED — INDEXING STARTS AUTOMATICALLY</p>
      )}
      {upload.phase === 'failed' && (
        <p role="alert" className="text-sm text-status-err">
          {upload.error ?? 'The upload failed.'}
        </p>
      )}
    </li>
  );
}

/** Upload page body (plan §4): drop zone, live rows, playability warning dialog. */
export function UploadView(): React.JSX.Element {
  const { uploads, startUpload, confirmUpload, cancelUpload, dismissUpload } = useUploads();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const takeFiles = (files: FileList | null): void => {
    for (const file of files ?? []) {
      startUpload(file);
    }
  };

  const warned = uploads.find((upload) => upload.phase === 'awaiting-confirmation');

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-widest text-accent">SIGNAL / UPLOAD</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Log new footage
        </h1>
        <p className="max-w-xl text-sm text-fg-muted">
          Files go straight from your browser to storage on a short-lived write pass, and indexing
          starts on its own. You can keep using the console while an upload runs.
        </p>
      </header>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          takeFiles(event.dataTransfer.files);
        }}
        className={cn(
          'film-frame transition-colors duration-150',
          dragging && 'border-accent-solid',
        )}
      >
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <UploadCloud aria-hidden className="size-8 text-fg-faint" />
          <p className="font-display text-lg font-medium">Drop footage here</p>
          <p className="max-w-md text-xs text-fg-muted">
            Any indexable container up to 2 GiB. Formats the browser can't play (AVI, MKV, WMV, …)
            still index — you get a warning first.
          </p>
          <Button
            size="sm"
            onClick={() => {
              inputRef.current?.click();
            }}
          >
            Browse files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            aria-label="Choose video files"
            onChange={(event) => {
              takeFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      {uploads.length > 0 && (
        <Section title="THIS SESSION">
          <ul className="flex flex-col gap-2">
            {uploads.map((upload) => (
              <UploadRow key={upload.key} upload={upload} onDismiss={dismissUpload} />
            ))}
          </ul>
        </Section>
      )}

      <AlertDialog
        open={warned !== undefined}
        onOpenChange={(open) => {
          // Dismissing the dialog (Esc / overlay) means "don't upload": the just
          // created document is deleted so no orphan row lingers (plan §4 warning).
          if (!open && warned !== undefined) {
            cancelUpload(warned.key);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>This format can't be previewed in the browser</AlertDialogTitle>
          <AlertDialogDescription>
            {warned?.fileName} will still be indexed — the transcript, insights, search, and
            download all work. It just won't play on the watch page.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button
                variant="ghost"
                onClick={() => {
                  if (warned !== undefined) {
                    cancelUpload(warned.key);
                  }
                }}
              >
                Cancel upload
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={() => {
                  if (warned !== undefined) {
                    confirmUpload(warned.key);
                  }
                }}
              >
                Upload anyway
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
