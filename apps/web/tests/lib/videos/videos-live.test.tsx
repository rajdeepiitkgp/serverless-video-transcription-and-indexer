import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useVideosLive, VideosLiveProvider } from '@/lib/videos/videos-live';

import { buildVideoSummary } from '../../support/builders';

const { toastMock, pushMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  pushMock: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function Probe(): React.JSX.Element {
  const { state, refetch } = useVideosLive();
  return (
    <div>
      <button onClick={refetch}>reload</button>
      <p data-testid="status">{state.status}</p>
      {state.status === 'success' && <p data-testid="count">{state.videos.length}</p>}
    </div>
  );
}

const renderProvider = (): void => {
  render(
    <VideosLiveProvider>
      <Probe />
    </VideosLiveProvider>,
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('VideosLiveProvider', () => {
  it('loads the library and exposes it', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse({ data: { videos: [buildVideoSummary()] } })),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('success');
    });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('announces a flip to Processed with a watch action', async () => {
    const indexing = buildVideoSummary({ status: 'Indexing' });
    const processed = buildVideoSummary({ status: 'Processed' });
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ data: { videos: [indexing] } }))
        .mockResolvedValueOnce(jsonResponse({ data: { videos: [processed] } })),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('success');
    });

    await userEvent.click(screen.getByRole('button', { name: 'reload' }));
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
    });
    const [title, options] = toastMock.success.mock.calls[0] as [
      string,
      { action?: { label?: string } },
    ];
    expect(title).toBe(`Processed — ${processed.name}`);
    expect(options.action?.label).toBe('Watch');
  });

  it('announces a flip to Failed as an error toast', async () => {
    const indexing = buildVideoSummary({ status: 'Indexing' });
    const failed = buildVideoSummary({ status: 'Failed' });
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ data: { videos: [indexing] } }))
        .mockResolvedValueOnce(jsonResponse({ data: { videos: [failed] } })),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('success');
    });

    await userEvent.click(screen.getByRole('button', { name: 'reload' }));
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled();
    });
  });

  it('never toasts on the first load', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ data: { videos: [buildVideoSummary({ status: 'Processed' })] } }),
        ),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('success');
    });
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('keeps the last good list when a later poll fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ data: { videos: [buildVideoSummary()] } }))
        .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 404)),
    );
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('success');
    });

    await userEvent.click(screen.getByRole('button', { name: 'reload' }));
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('success');
    });
  });
});
