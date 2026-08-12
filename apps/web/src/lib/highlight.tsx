import { type ReactNode } from 'react';

/**
 * Wraps case-insensitive occurrences of `query` in amber `<mark>`s so a search hit
 * shows *why* it matched. Plain string matching — no regex, so user input needs no
 * escaping.
 */
export function highlightQuery(text: string, query: string): ReactNode {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return text;
  }
  const lower = text.toLowerCase();
  const nodes: ReactNode[] = [];
  let index = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, index)) {
    if (at > index) {
      nodes.push(text.slice(index, at));
    }
    nodes.push(
      <mark key={String(at)} className="rounded-xs bg-accent-solid/25 text-inherit">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    index = at + needle.length;
  }
  if (nodes.length === 0) {
    return text;
  }
  if (index < text.length) {
    nodes.push(text.slice(index));
  }
  return nodes;
}
