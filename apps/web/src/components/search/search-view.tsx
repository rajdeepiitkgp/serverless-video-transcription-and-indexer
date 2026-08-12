'use client';

import { type SearchMatch, type SearchResult } from '@vidx/shared';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { LoadingPanel } from '@/components/feedback/loading-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusChip } from '@/components/video/status-chip';
import { Timecode } from '@/components/video/timecode';
import { useSearchResults } from '@/lib/api/hooks';
import { highlightQuery } from '@/lib/highlight';

const FIELD_LABELS: Record<Exclude<SearchMatch['field'], 'transcript'>, string> = {
  name: 'NAME',
  keyword: 'KEYWORD',
  topic: 'TOPIC',
};

function MatchRow({
  videoId,
  match,
  query,
}: {
  videoId: string;
  match: SearchMatch;
  query: string;
}): React.JSX.Element {
  if (match.field === 'transcript' && match.startSeconds !== undefined) {
    // The search-to-seek deep link (plan §4): open the watch page at this moment.
    return (
      <li>
        <Link
          href={`/videos/watch/?id=${encodeURIComponent(videoId)}&t=${String(match.startSeconds)}`}
          className="flex items-baseline gap-3 rounded-sm px-2 py-1.5 transition-colors duration-150 hover:bg-raised"
        >
          <Timecode seconds={match.startSeconds} className="shrink-0 text-accent" />
          <span className="text-sm text-fg-muted">{highlightQuery(match.snippet, query)}</span>
        </Link>
      </li>
    );
  }
  return (
    <li className="flex items-baseline gap-3 px-2 py-1.5">
      <Badge variant="outline" className="shrink-0">
        {match.field === 'transcript' ? 'TRANSCRIPT' : FIELD_LABELS[match.field]}
      </Badge>
      <span className="text-sm text-fg-muted">{highlightQuery(match.snippet, query)}</span>
    </li>
  );
}

function ResultCard({ result, query }: { result: SearchResult; query: string }): React.JSX.Element {
  return (
    <li className="rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/videos/watch/?id=${encodeURIComponent(result.id)}`}
          className="min-w-0 truncate text-sm font-medium transition-colors duration-150 hover:text-accent"
        >
          {result.name}
        </Link>
        <StatusChip status={result.status} />
      </div>
      <ul className="mt-2 flex flex-col">
        {result.matches.map((match, index) => (
          <MatchRow key={index} videoId={result.id} match={match} query={query} />
        ))}
      </ul>
    </li>
  );
}

function SearchForm({ initialQuery }: { initialQuery: string }): React.JSX.Element {
  const router = useRouter();
  const [draft, setDraft] = useState(initialQuery);
  return (
    <form
      role="search"
      className="flex max-w-xl gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (trimmed !== '') {
          router.push(`/search/?q=${encodeURIComponent(trimmed)}`);
        }
      }}
    >
      <Input
        type="search"
        name="q"
        value={draft}
        aria-label="Search transcripts"
        placeholder="launch date, roadmap, “second week of October”…"
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
      <Button type="submit">
        <Search aria-hidden />
        Search
      </Button>
    </form>
  );
}

function SearchContent(): React.JSX.Element {
  const params = useSearchParams();
  const query = params.get('q') ?? '';
  const results = useSearchResults(query === '' ? null : query);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-widest text-accent">SIGNAL / SEARCH</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Scrub the archive
        </h1>
        <p className="max-w-xl text-sm text-fg-muted">
          Search names, keywords, topics, and every spoken line. A transcript hit opens the watch
          page at the exact moment it was said.
        </p>
      </header>

      {/* Keyed on the URL's query so header searches and back/forward reset the box. */}
      <SearchForm key={query} initialQuery={query} />

      {query === '' ? (
        <EmptyState title="Nothing scanned yet">
          <p>Try a keyword, a topic, or a phrase you remember hearing.</p>
        </EmptyState>
      ) : results.status === 'error' ? (
        <ErrorPanel title="Search failed" error={results.error} onRetry={results.refetch} />
      ) : results.status === 'success' ? (
        results.data.results.length === 0 ? (
          <EmptyState title={`No hits for “${query}”`}>
            <p>Try a shorter phrase — the transcript match is exact, not fuzzy.</p>
          </EmptyState>
        ) : (
          <section aria-label="Search results" className="flex flex-col gap-3">
            <p className="font-mono text-xs text-fg-faint">
              {results.data.results.length} {results.data.results.length === 1 ? 'video' : 'videos'}{' '}
              · {results.data.results.reduce((sum, result) => sum + result.matches.length, 0)}{' '}
              matches
            </p>
            <ul className="flex flex-col gap-3">
              {results.data.results.map((result) => (
                <ResultCard key={result.id} result={result} query={query} />
              ))}
            </ul>
          </section>
        )
      ) : (
        <LoadingPanel label="Searching" />
      )}
    </div>
  );
}

/** Search page body; useSearchParams requires a Suspense boundary under static export. */
export function SearchView(): React.JSX.Element {
  return (
    <Suspense fallback={<LoadingPanel label="Loading search" />}>
      <SearchContent />
    </Suspense>
  );
}
