import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibraryView } from '@/components/library/library-view';
import { type CurrentUserState } from '@/lib/auth/use-current-user';
import { type VideosLiveState } from '@/lib/videos/videos-live';

import { buildVideoSummary } from '../../support/builders';

const { state, toastMock, refetchMock } = vi.hoisted(() => {
  const state: { videos: VideosLiveState; user: CurrentUserState } = {
    videos: { status: 'loading' },
    user: { status: 'loading', user: null },
  };
  return {
    state,
    toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
    refetchMock: vi.fn(),
  };
});

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/lib/videos/videos-live', () => ({
  useVideosLive: () => ({ state: state.videos, refetch: refetchMock }),
}));
vi.mock('@/lib/auth/use-current-user', () => ({
  useCurrentUser: () => state.user,
}));

const signIn = (userId: string, roles: string[]): void => {
  state.user = {
    status: 'signed-in',
    user: {
      identityProvider: 'aad',
      userId,
      userDetails: 'ana@example.com',
      userRoles: ['anonymous', 'authenticated', ...roles],
    },
  };
};

const twoVideos = (): VideosLiveState => ({
  status: 'success',
  videos: [
    buildVideoSummary({ id: 'mine', name: 'mine.mp4' }),
    buildVideoSummary({
      id: 'theirs',
      name: 'theirs.mp4',
      uploadedBy: { userId: 'user-2', userDetails: 'kim@example.com' },
    }),
  ],
});

describe('LibraryView', () => {
  beforeEach(() => {
    state.videos = twoVideos();
    signIn('user-1', []);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('links every card to its watch page', () => {
    render(<LibraryView />);
    expect(screen.getByRole('link', { name: /mine\.mp4/ })).toHaveAttribute(
      'href',
      '/videos/watch?id=mine',
    );
  });

  it('offers delete only on the caller their own uploads', () => {
    render(<LibraryView />);
    expect(screen.getByRole('button', { name: 'Delete mine.mp4' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete theirs.mp4' })).not.toBeInTheDocument();
  });

  it('lets an admin delete anything', () => {
    signIn('user-1', ['admin']);
    render(<LibraryView />);
    expect(screen.getByRole('button', { name: 'Delete mine.mp4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete theirs.mp4' })).toBeInTheDocument();
  });

  it('confirms before deleting, then deletes and refreshes', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'mine' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<LibraryView />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete mine.mp4' }));
    expect(screen.getByText(/permanently removes the source video/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete video' }));
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith('Deleted — mine.mp4');
    });
    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/videos/mine');
    expect(init?.method).toBe('DELETE');
    expect(refetchMock).toHaveBeenCalled();
  });

  it('keeps the video when the dialog is dismissed', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    render(<LibraryView />);

    await userEvent.click(screen.getByRole('button', { name: 'Delete mine.mp4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the empty invitation when nothing is logged', () => {
    state.videos = { status: 'success', videos: [] };
    render(<LibraryView />);
    expect(screen.getByText('No footage in the library')).toBeInTheDocument();
  });
});
