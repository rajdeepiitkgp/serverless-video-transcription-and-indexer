import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider } from '@/components/theme/theme-provider';
import { ThemeToggle } from '@/components/theme/theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
  });

  it('offers light, system, and dark as a radio group', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole('radiogroup', { name: 'Color theme' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Light theme' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Match system theme' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark theme' })).toBeInTheDocument();
  });

  it('applies the chosen theme class and persists it to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('radio', { name: 'Dark theme' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('theme')).toBe('dark');

    await user.click(screen.getByRole('radio', { name: 'Light theme' }));
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(window.localStorage.getItem('theme')).toBe('light');
  });
});
