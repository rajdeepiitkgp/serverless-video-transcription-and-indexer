import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WATERMARK_INTERVAL_MS, WatermarkOverlay } from '@/components/player/watermark-overlay';

describe('WatermarkOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the attribution label', () => {
    render(<WatermarkOverlay label="ana@example.com" />);
    expect(screen.getByTestId('watermark')).toHaveTextContent('ana@example.com');
  });

  it('repositions periodically so crops stay attributable', () => {
    render(<WatermarkOverlay label="ana@example.com" />);
    const before = screen.getByTestId('watermark').className;
    act(() => {
      vi.advanceTimersByTime(WATERMARK_INTERVAL_MS);
    });
    expect(screen.getByTestId('watermark').className).not.toBe(before);
  });

  it('stays out of the accessibility tree and pointer path', () => {
    const { container } = render(<WatermarkOverlay label="ana@example.com" />);
    const overlay = container.firstElementChild;
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay?.className).toContain('pointer-events-none');
  });
});
