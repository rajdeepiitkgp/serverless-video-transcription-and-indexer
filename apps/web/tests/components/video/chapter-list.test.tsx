import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChapterList } from '@/components/video/chapter-list';

const CHAPTERS = [
  { title: 'Introductions', startSeconds: 0, endSeconds: 60 },
  { title: 'The launch date', startSeconds: 60, endSeconds: 252 },
];

describe('ChapterList', () => {
  it('renders nothing when there are no chapters', () => {
    const { container } = render(<ChapterList chapters={[]} currentSeconds={0} onSeek={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('numbers chapters in playback order with start timecodes', () => {
    render(<ChapterList chapters={CHAPTERS} currentSeconds={0} onSeek={vi.fn()} />);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('00:01:00')).toBeInTheDocument();
  });

  it('marks the chapter whose start has been passed as current', () => {
    render(<ChapterList chapters={CHAPTERS} currentSeconds={75} onSeek={vi.fn()} />);
    expect(screen.getByRole('button', { current: true })).toHaveTextContent('The launch date');
  });

  it('seeks to the chapter start on click', async () => {
    const onSeek = vi.fn();
    const user = userEvent.setup();
    render(<ChapterList chapters={CHAPTERS} currentSeconds={0} onSeek={onSeek} />);
    await user.click(screen.getByText('The launch date'));
    expect(onSeek).toHaveBeenCalledWith(60);
  });
});
