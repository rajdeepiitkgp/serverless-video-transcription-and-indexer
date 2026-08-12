import { HealthIndicator } from '@/components/layout/health-indicator';

/** Footer: tagline left, the live API health dot right (plan §4). */
export function AppFooter(): React.JSX.Element {
  return (
    <footer className="mt-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="scanline" role="presentation" />
        <div className="flex items-center justify-between gap-4 py-4">
          <p className="font-mono text-xs text-fg-faint">
            SIGNAL · serverless video transcription &amp; indexing
          </p>
          <HealthIndicator />
        </div>
      </div>
    </footer>
  );
}
