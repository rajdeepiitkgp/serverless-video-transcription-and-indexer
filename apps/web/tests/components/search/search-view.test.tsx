import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchView } from '@/components/search/search-view';

const { navigation } = vi.hoisted(() => ({
  navigation: { params: new URLSearchParams(), push: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => navigation.params,
  useRouter: () => ({ push: navigation.push }),
}));

const searchResponse = (): Response =>
  new Response(
    JSON.stringify({
      data: {
        results: [
          {
            id: 'vid-1',
            name: 'launch-briefing.mp4',
            status: 'Processed',
            matches: [
              { field: 'keyword', snippet: 'october' },
              {
                field: 'transcript',
                snippet: "We're locking it to the second week of October.",
                startSeconds: 21,
              },
            ],
          },
        ],
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('SearchView', () => {
  it('invites a query when none is set', () => {
    navigation.params = new URLSearchParams();
    render(<SearchView />);
    expect(screen.getByText('Nothing scanned yet')).toBeInTheDocument();
  });

  it('renders hits with search-to-seek deep links and highlights', async () => {
    navigation.params = new URLSearchParams('q=october');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(searchResponse()));
    render(<SearchView />);

    await waitFor(() => {
      expect(screen.getByText('launch-briefing.mp4')).toBeInTheDocument();
    });

    // The transcript hit deep-links to the exact moment (plan §4 search-to-seek).
    const seekLink = screen.getByRole('link', { name: /second week of October/ });
    expect(seekLink).toHaveAttribute('href', '/videos/watch?id=vid-1&t=21');
    expect(screen.getByText('00:00:21')).toBeInTheDocument();

    // Non-transcript matches wear their field badge instead.
    expect(screen.getByText('KEYWORD')).toBeInTheDocument();

    // The query is marked inside the snippet.
    const marks = screen.getAllByText(/october/i).filter((node) => node.tagName === 'MARK');
    expect(marks.length).toBeGreaterThan(0);
  });

  it('says when nothing matched', async () => {
    navigation.params = new URLSearchParams('q=zebra');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ data: { results: [] } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    render(<SearchView />);
    await waitFor(() => {
      expect(screen.getByText('No hits for “zebra”')).toBeInTheDocument();
    });
  });

  it('submits a new query to the URL', async () => {
    navigation.params = new URLSearchParams();
    render(<SearchView />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search transcripts' }), 'launch');
    await userEvent.click(screen.getByRole('button', { name: /Search/ }));
    expect(navigation.push).toHaveBeenCalledWith('/search/?q=launch');
  });
});
