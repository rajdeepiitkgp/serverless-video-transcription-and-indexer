/** Footer. The live health dot (fed by /api/health) lands with the rest of M4. */
export function AppFooter(): React.JSX.Element {
  return (
    <footer className="mt-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="scanline" role="presentation" />
        <p className="py-4 font-mono text-xs text-fg-faint">
          SIGNAL · serverless video transcription &amp; indexing
        </p>
      </div>
    </footer>
  );
}
