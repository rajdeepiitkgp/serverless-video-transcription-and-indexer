import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MainNav } from '@/components/layout/main-nav';

const { pathname } = vi.hoisted(() => ({ pathname: { value: '/' } }));

vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

describe('MainNav', () => {
  it('marks the console link current on the dashboard', () => {
    pathname.value = '/';
    render(<MainNav />);
    expect(screen.getByRole('link', { name: 'CONSOLE' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'LIBRARY' })).not.toHaveAttribute('aria-current');
  });

  it('keeps the library lit on the watch page', () => {
    pathname.value = '/videos/watch/';
    render(<MainNav />);
    expect(screen.getByRole('link', { name: 'LIBRARY' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'CONSOLE' })).not.toHaveAttribute('aria-current');
  });
});
