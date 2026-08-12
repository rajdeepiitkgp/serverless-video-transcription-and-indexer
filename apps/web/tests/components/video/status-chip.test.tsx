import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusChip } from '@/components/video/status-chip';

describe('StatusChip', () => {
  it.each(['Uploaded', 'Indexing', 'Processed', 'Failed'] as const)(
    'labels the %s status',
    (status) => {
      render(<StatusChip status={status} />);
      expect(screen.getByText(status.toUpperCase())).toBeInTheDocument();
    },
  );

  it('pulses only while indexing', () => {
    const { container, rerender } = render(<StatusChip status="Indexing" />);
    expect(container.querySelector('.motion-safe\\:animate-signal-pulse')).not.toBeNull();
    rerender(<StatusChip status="Processed" />);
    expect(container.querySelector('.motion-safe\\:animate-signal-pulse')).toBeNull();
  });
});
