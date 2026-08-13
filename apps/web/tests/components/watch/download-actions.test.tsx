import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DownloadActions } from '@/components/watch/download-actions';

// jsdom implements neither object URLs nor anchor-click navigation; capture both.
const createObjectURL = vi.fn(() => 'blob:mock-url');
const revokeObjectURL = vi.fn();
const anchorClick = vi.fn();

const stubFetch = (response: Response): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const setup = (): void => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(anchorClick);
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('DownloadActions', () => {
  it('saves the streamed VTT body under the server-chosen filename', async () => {
    const user = userEvent.setup();
    setup();
    const fetchMock = stubFetch(
      new Response('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello.', {
        status: 200,
        headers: {
          'content-type': 'text/vtt',
          'content-disposition': 'attachment; filename="launch-briefing.vtt"',
        },
      }),
    );
    render(<DownloadActions videoId="vid-1" hasTranscript />);

    await user.click(screen.getByRole('button', { name: /subtitles \(\.vtt\)/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/videos/vid-1/download/transcript?format=vtt',
      expect.anything(),
    );
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchorClick).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('saves the transcript JSON (a bare array, not an envelope)', async () => {
    const user = userEvent.setup();
    setup();
    stubFetch(
      new Response(JSON.stringify([{ text: 'Hello.', startSeconds: 0, endSeconds: 5 }]), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-disposition': 'attachment; filename="launch-briefing.json"',
        },
      }),
    );
    render(<DownloadActions videoId="vid-1" hasTranscript />);

    await user.click(screen.getByRole('button', { name: /transcript \(\.json\)/i }));

    expect(anchorClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('navigates to the SAS URL for the video download', async () => {
    const user = userEvent.setup();
    setup();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    stubFetch(
      new Response(
        JSON.stringify({
          data: {
            url: 'https://storage.example/videos/vid-1.mp4?sig=abc',
            fileName: 'vid-1.mp4',
            expiresAt: '2026-08-13T20:00:00Z',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    render(<DownloadActions videoId="vid-1" hasTranscript />);

    await user.click(screen.getByRole('button', { name: /download video/i }));

    expect(assign).toHaveBeenCalledWith('https://storage.example/videos/vid-1.mp4?sig=abc');
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('surfaces the error envelope with its tracking id when a download fails', async () => {
    const user = userEvent.setup();
    setup();
    stubFetch(
      new Response(
        JSON.stringify({
          error: { code: 'not_ready', message: 'Still indexing.', trackingId: 'VXT-a1b2c3d4' },
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    );
    render(<DownloadActions videoId="vid-1" hasTranscript />);

    await user.click(screen.getByRole('button', { name: /subtitles \(\.vtt\)/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Still indexing. (support ID VXT-a1b2c3d4)',
    );
    expect(anchorClick).not.toHaveBeenCalled();
  });

  it('hides the transcript buttons until a transcript exists', () => {
    render(<DownloadActions videoId="vid-1" hasTranscript={false} />);
    expect(screen.getByRole('button', { name: /download video/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /subtitles/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /transcript/i })).toBeNull();
  });
});
