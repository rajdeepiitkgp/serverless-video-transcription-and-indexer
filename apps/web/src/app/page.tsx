import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function HomePage(): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-6 py-16">
      <p className="font-mono text-xs tracking-widest text-accent">SIGNAL / M4 DESIGN PREVIEW</p>
      <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Every upload is footage with a signal to extract.
      </h1>
      <p className="max-w-xl text-fg-muted">
        Signal turns raw video into transcripts, keywords, topics, and searchable moments. The
        console — dashboard, upload, library, and search — is built after the design language below
        is signed off.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/design/">Review the design reference</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/videos/watch/">Open the watch page</Link>
        </Button>
      </div>
    </div>
  );
}
