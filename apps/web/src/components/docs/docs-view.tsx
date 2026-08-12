'use client';

// The wrapper package imports this stylesheet from inside the dynamically imported
// chunk, where the bundler drops it — Scalar then mounts completely unstyled
// (issue #10). Importing it here puts it in the page's own CSS graph.
import '@scalar/api-reference-react/style.css';

import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';

import { LoadingPanel } from '@/components/feedback/loading-panel';

// Scalar mounts a client-side app over the OpenAPI document; there's nothing to
// prerender at export time.
const ApiReferenceReact = dynamic(
  () => import('@scalar/api-reference-react').then((mod) => mod.ApiReferenceReact),
  { ssr: false, loading: () => <LoadingPanel label="Loading the API reference" /> },
);

/**
 * Scalar API reference inside the app shell (plan §4): same header, one click back
 * to any console page — no dead-end docs site. It renders `/api/openapi.json`, which
 * sits behind the same auth wall, and "try it" requests ride the session cookie.
 * Scalar keeps its own documentation look; only the dark/light choice follows the
 * console's theme toggle.
 */
export function DocsView(): React.JSX.Element {
  const { resolvedTheme } = useTheme();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-widest text-accent">SIGNAL / API</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          API reference
        </h1>
        <p className="max-w-xl text-sm text-fg-muted">
          Every route the console uses, rendered live from the OpenAPI document. "Try it" requests
          run with your session — what works here works in your own scripts.
        </p>
      </header>
      <div className="overflow-hidden rounded-md border border-line">
        <ApiReferenceReact
          configuration={{
            url: '/api/openapi.json',
            darkMode: resolvedTheme !== 'light',
            hideDarkModeToggle: true,
          }}
        />
      </div>
    </div>
  );
}
