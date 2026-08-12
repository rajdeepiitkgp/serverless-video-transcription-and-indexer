import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { statusCellCounts, StatusStrip } from '@/components/dashboard/status-strip';

describe('statusCellCounts', () => {
  it('returns all zeros for an empty library', () => {
    expect(statusCellCounts({ Uploaded: 0, Indexing: 0, Processed: 0, Failed: 0 })).toEqual({
      Uploaded: 0,
      Indexing: 0,
      Processed: 0,
      Failed: 0,
    });
  });

  it('apportions all cells proportionally', () => {
    const cells = statusCellCounts({ Uploaded: 1, Indexing: 1, Processed: 6, Failed: 2 }, 40);
    expect(cells.Uploaded + cells.Indexing + cells.Processed + cells.Failed).toBe(40);
    expect(cells.Processed).toBe(24);
    expect(cells.Failed).toBe(8);
  });

  it('never rounds a present status down to zero cells', () => {
    const cells = statusCellCounts({ Uploaded: 0, Indexing: 0, Processed: 999, Failed: 1 }, 40);
    expect(cells.Failed).toBeGreaterThanOrEqual(1);
    expect(cells.Processed + cells.Failed).toBe(40);
  });
});

describe('StatusStrip', () => {
  it('renders a labeled count for every status', () => {
    render(<StatusStrip counts={{ Uploaded: 3, Indexing: 2, Processed: 14, Failed: 1 }} />);
    expect(screen.getByText('UPLOADED')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
  });
});
