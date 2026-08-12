import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StageTimeline } from '@/components/video/stage-timeline';

describe('StageTimeline', () => {
  it('shows all three stages for a fresh upload', () => {
    render(<StageTimeline status="Uploaded" />);
    expect(screen.getByText('UPLOADED')).toBeInTheDocument();
    expect(screen.getByText('INDEXING')).toBeInTheDocument();
    expect(screen.getByText('PROCESSED')).toBeInTheDocument();
  });

  it('labels the whole run by its status', () => {
    render(<StageTimeline status="Indexing" />);
    expect(screen.getByRole('list', { name: 'Stage: Indexing' })).toBeInTheDocument();
  });

  it('replaces the indexing stage with FAILED on failure', () => {
    render(<StageTimeline status="Failed" />);
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.queryByText('INDEXING')).not.toBeInTheDocument();
  });
});
