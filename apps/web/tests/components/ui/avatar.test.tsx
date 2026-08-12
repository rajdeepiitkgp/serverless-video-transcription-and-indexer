import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, avatarFillIndex, avatarInitials } from '@/components/ui/avatar';

describe('avatarInitials', () => {
  it.each([
    ['ana.lima@example.com', 'AL'],
    ['kim_park@example.com', 'KP'],
    ['bob@example.com', 'BO'],
    ['x', 'X'],
  ])('derives %s → %s', (userDetails, expected) => {
    expect(avatarInitials(userDetails)).toBe(expected);
  });
});

describe('avatarFillIndex', () => {
  it('is deterministic and in range', () => {
    const first = avatarFillIndex('ana@example.com');
    expect(avatarFillIndex('ana@example.com')).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(6);
  });

  it('varies across users', () => {
    const indexes = new Set(
      ['ana@example.com', 'kim@example.com', 'bob@example.com', 'dee@example.com'].map(
        avatarFillIndex,
      ),
    );
    expect(indexes.size).toBeGreaterThan(1);
  });
});

describe('Avatar', () => {
  it('renders the initials', () => {
    render(<Avatar userDetails="ana.lima@example.com" />);
    expect(screen.getByText('AL')).toBeInTheDocument();
  });
});
