import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { highlightQuery } from '@/lib/highlight';

describe('highlightQuery', () => {
  it('marks case-insensitive occurrences', () => {
    render(<p>{highlightQuery("We're locking it to the second week of October.", 'october')}</p>);
    const mark = screen.getByText('October');
    expect(mark.tagName).toBe('MARK');
  });

  it('marks every occurrence, not just the first', () => {
    render(<p>{highlightQuery('launch the launch', 'launch')}</p>);
    expect(screen.getAllByText('launch')).toHaveLength(2);
  });

  it('returns the text untouched when nothing matches', () => {
    render(<p>{highlightQuery('no hits here', 'zebra')}</p>);
    expect(screen.getByText('no hits here').querySelector('mark')).toBeNull();
  });

  it('treats regex metacharacters as plain text', () => {
    render(<p>{highlightQuery('cost is $4.99 today', '$4.99')}</p>);
    expect(screen.getByText('$4.99').tagName).toBe('MARK');
  });
});
