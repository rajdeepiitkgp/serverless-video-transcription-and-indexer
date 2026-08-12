import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WatchView } from '@/components/watch/watch-view';

import { buildTranscriptLines, buildVideoDetail } from '../../support/builders';

// The real player boots media-chrome web components; the view is tested against the
// player's prop contract instead (the player itself is exercised in the browser).
vi.mock('@/components/player/video-player', () => ({
  VideoPlayer: ({ src, watermark }: { src: string; watermark: string | null }) => (
    <div data-testid="video-player" data-src={src} data-watermark={watermark ?? ''} />
  ),
}));

const successTranscript = { status: 'success' as const, data: { lines: buildTranscriptLines() } };

describe('WatchView', () => {
  it('plays processed, playable footage with the forensic watermark', () => {
    render(
      <WatchView
        detail={buildVideoDetail()}
        transcriptState={successTranscript}
        watermark="ana@example.com"
      />,
    );
    const player = screen.getByTestId('video-player');
    expect(player).toHaveAttribute('data-src', expect.stringContaining('vid-1.mp4'));
    expect(player).toHaveAttribute('data-watermark', 'ana@example.com');
  });

  it('shows the indexing placeholder while the pipeline runs', () => {
    render(
      <WatchView
        detail={buildVideoDetail({ status: 'Indexing', playbackUrl: null, captionsUrl: null })}
        transcriptState={{ status: 'success', data: { lines: [] } }}
        watermark={null}
      />,
    );
    expect(screen.getByText('Indexing in progress')).toBeInTheDocument();
    expect(screen.queryByTestId('video-player')).toBeNull();
  });

  it('shows the pipeline error when indexing failed', () => {
    render(
      <WatchView
        detail={buildVideoDetail({
          status: 'Failed',
          playbackUrl: null,
          captionsUrl: null,
          error: 'The media file could not be decoded.',
        })}
        transcriptState={{ status: 'success', data: { lines: [] } }}
        watermark={null}
      />,
    );
    expect(screen.getByText('Indexing failed')).toBeInTheDocument();
    expect(screen.getByText('The media file could not be decoded.')).toBeInTheDocument();
    expect(
      screen.getByText('Indexing failed before a transcript was produced.'),
    ).toBeInTheDocument();
  });

  it('replaces the player for non-browser-playable formats but keeps the rest', () => {
    render(
      <WatchView
        detail={buildVideoDetail({ playable: false, playbackUrl: null })}
        transcriptState={successTranscript}
        watermark={null}
      />,
    );
    expect(screen.getByText("This format can't be previewed in the browser")).toBeInTheDocument();
    expect(screen.queryByTestId('video-player')).toBeNull();
    // Transcript, insights, and downloads still work (plan §4).
    expect(screen.getByText('Welcome, everyone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download video/i })).toBeInTheDocument();
  });

  it('renders metadata, insights, and chapters', () => {
    render(
      <WatchView
        detail={buildVideoDetail()}
        transcriptState={successTranscript}
        watermark={null}
      />,
    );
    expect(screen.getByRole('heading', { name: 'launch-briefing.mp4' })).toBeInTheDocument();
    expect(screen.getByText(/ana@example\.com/)).toBeInTheDocument();
    expect(screen.getByText('launch')).toBeInTheDocument();
    expect(screen.getByText('Product planning')).toBeInTheDocument();
    expect(screen.getByText('The launch date')).toBeInTheDocument();
  });

  it('moves the transcript playhead when a line is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WatchView
        detail={buildVideoDetail()}
        transcriptState={successTranscript}
        watermark={null}
      />,
    );
    await user.click(screen.getByText("We're locking it to the second week of October."));
    const active = screen.getAllByRole('button', { current: true });
    expect(active.map((element) => element.textContent).join(' ')).toContain(
      'second week of October',
    );
  });
});
