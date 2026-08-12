'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { LoadingPanel } from '@/components/feedback/loading-panel';
import { Button } from '@/components/ui/button';
import { WatchView } from '@/components/watch/watch-view';
import { useTranscript, useVideoDetail } from '@/lib/api/hooks';
import { useCurrentUser } from '@/lib/auth/use-current-user';

const parseStartSeconds = (raw: string | null): number | undefined => {
  if (raw === null) {
    return undefined;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

function WatchPageContent(): React.JSX.Element {
  const params = useSearchParams();
  const id = params.get('id');
  const initialSeconds = parseStartSeconds(params.get('t'));

  const detailState = useVideoDetail(id);
  const transcriptState = useTranscript(id);
  const { user } = useCurrentUser();

  if (id === null) {
    return (
      <EmptyState title="No video selected">
        <p>Open a video from the library or a search result to watch it here.</p>
        <div className="mt-4">
          <Button asChild variant="secondary" size="sm">
            <Link href="/">Back to the console</Link>
          </Button>
        </div>
      </EmptyState>
    );
  }

  switch (detailState.status) {
    case 'idle':
    case 'loading':
      return <LoadingPanel label="Loading video" />;
    case 'error':
      return (
        <ErrorPanel
          title="Couldn't load this video"
          error={detailState.error}
          onRetry={detailState.refetch}
        />
      );
    case 'success':
      return (
        <WatchView
          detail={detailState.data}
          transcriptState={transcriptState}
          watermark={user === null ? null : user.userDetails}
          {...(initialSeconds === undefined ? {} : { initialSeconds })}
        />
      );
  }
}

export default function WatchPage(): React.JSX.Element {
  // useSearchParams requires a Suspense boundary under static export.
  return (
    <Suspense fallback={<LoadingPanel label="Loading video" />}>
      <WatchPageContent />
    </Suspense>
  );
}
