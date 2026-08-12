import {
  type SearchMatch,
  type SearchResult,
  searchResultSchema,
  type VideoDocument,
} from '@vidx/shared';

/**
 * Transcript hits are capped per video so one chatty lecture can't flood the result
 * list; the first N in timestamp order are the ones a viewer seeks to anyway.
 */
export const MAX_TRANSCRIPT_MATCHES_PER_VIDEO = 5;

function containsTerm(text: string, lowerTerm: string): boolean {
  return text.toLowerCase().includes(lowerTerm);
}

/**
 * Builds the match list for the search response (plan §4): case-insensitive contains
 * across name/keywords/topics/transcript lines. The repository's Cosmos query is only
 * a prefilter — this is the authoritative matcher, so a candidate document with no
 * actual match yields no result. Transcript matches carry `startSeconds` to power
 * search-to-seek deep links.
 */
export function searchVideos(documents: readonly VideoDocument[], term: string): SearchResult[] {
  const lowerTerm = term.trim().toLowerCase();
  if (lowerTerm === '') return [];

  const results: SearchResult[] = [];
  for (const document of documents) {
    const matches: SearchMatch[] = [];

    if (containsTerm(document.name, lowerTerm)) {
      matches.push({ field: 'name', snippet: document.name });
    }
    for (const keyword of document.keywords) {
      if (containsTerm(keyword, lowerTerm)) matches.push({ field: 'keyword', snippet: keyword });
    }
    for (const topic of document.topics) {
      if (containsTerm(topic, lowerTerm)) matches.push({ field: 'topic', snippet: topic });
    }

    let transcriptMatches = 0;
    for (const line of document.transcript) {
      if (transcriptMatches >= MAX_TRANSCRIPT_MATCHES_PER_VIDEO) break;
      if (containsTerm(line.text, lowerTerm)) {
        transcriptMatches += 1;
        matches.push({ field: 'transcript', snippet: line.text, startSeconds: line.startSeconds });
      }
    }

    if (matches.length > 0) {
      results.push(
        searchResultSchema.parse({
          id: document.id,
          name: document.name,
          status: document.status,
          matches,
        }),
      );
    }
  }
  return results;
}
