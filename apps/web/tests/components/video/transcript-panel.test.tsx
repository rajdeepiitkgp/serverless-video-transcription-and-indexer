import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TranscriptPanel } from '@/components/video/transcript-panel';

import { buildTranscriptLines } from '../../support/builders';

describe('TranscriptPanel', () => {
  it('renders every line with its timecode', () => {
    render(
      <TranscriptPanel
        lines={buildTranscriptLines()}
        currentSeconds={0}
        onSeek={vi.fn()}
        emptyMessage="unused"
      />,
    );
    expect(screen.getByText('Welcome, everyone.')).toBeInTheDocument();
    expect(screen.getByText('00:00:04')).toBeInTheDocument();
  });

  it('marks the line under the playhead as current', () => {
    render(
      <TranscriptPanel
        lines={buildTranscriptLines()}
        currentSeconds={5}
        onSeek={vi.fn()}
        emptyMessage="unused"
      />,
    );
    const active = screen.getByRole('button', { current: true });
    expect(active).toHaveTextContent('the launch date');
  });

  it('marks nothing current in a gap between lines', () => {
    render(
      <TranscriptPanel
        lines={buildTranscriptLines()}
        currentSeconds={99}
        onSeek={vi.fn()}
        emptyMessage="unused"
      />,
    );
    expect(screen.queryByRole('button', { current: true })).toBeNull();
  });

  it('seeks to the line start on click', async () => {
    const onSeek = vi.fn();
    const user = userEvent.setup();
    render(
      <TranscriptPanel
        lines={buildTranscriptLines()}
        currentSeconds={0}
        onSeek={onSeek}
        emptyMessage="unused"
      />,
    );
    await user.click(screen.getByText("We're locking it to the second week of October."));
    expect(onSeek).toHaveBeenCalledWith(9);
  });

  it('lets the user switch follow-playback off and on', async () => {
    const user = userEvent.setup();
    render(
      <TranscriptPanel
        lines={buildTranscriptLines()}
        currentSeconds={0}
        onSeek={vi.fn()}
        emptyMessage="unused"
      />,
    );
    const follow = screen.getByRole('button', { name: 'FOLLOW' });
    expect(follow).toHaveAttribute('aria-pressed', 'true');
    await user.click(follow);
    expect(follow).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the empty message when there are no lines', () => {
    render(
      <TranscriptPanel
        lines={[]}
        currentSeconds={0}
        onSeek={vi.fn()}
        emptyMessage="The transcript appears when indexing completes."
      />,
    );
    expect(screen.getByText('The transcript appears when indexing completes.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'FOLLOW' })).toBeNull();
  });
});
