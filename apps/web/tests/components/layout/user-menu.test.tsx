import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserMenu } from '@/components/layout/user-menu';
import { type CurrentUserState } from '@/lib/auth/use-current-user';

const { currentUser } = vi.hoisted(() => {
  const currentUser: { value: CurrentUserState } = {
    value: { status: 'loading', user: null },
  };
  return { currentUser };
});

vi.mock('@/lib/auth/use-current-user', () => ({
  useCurrentUser: () => currentUser.value,
}));

describe('UserMenu', () => {
  beforeEach(() => {
    currentUser.value = { status: 'loading', user: null };
  });

  it('offers sign-in to anonymous visitors', () => {
    currentUser.value = { status: 'anonymous', user: null };
    render(<UserMenu />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/.auth/login/aad',
    );
  });

  it('shows identity, roles, and the session links', async () => {
    currentUser.value = {
      status: 'signed-in',
      user: {
        identityProvider: 'aad',
        userId: 'user-1',
        userDetails: 'ana.lima@example.com',
        userRoles: ['anonymous', 'authenticated', 'admin'],
      },
    };
    render(<UserMenu />);

    const trigger = screen.getByRole('button', { name: 'Account: ana.lima@example.com' });
    expect(trigger).toHaveTextContent('AL');
    await userEvent.click(trigger);

    expect(screen.getByText('ana.lima@example.com')).toBeInTheDocument();
    expect(screen.getByText('Microsoft account')).toBeInTheDocument();
    expect(screen.getByText('authenticated')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.queryByText('anonymous')).not.toBeInTheDocument();

    expect(screen.getByRole('menuitem', { name: 'API docs' })).toHaveAttribute('href', '/docs');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveAttribute(
      'href',
      '/.auth/logout',
    );
    expect(screen.getByRole('menuitem', { name: 'Switch account' })).toHaveAttribute(
      'href',
      '/.auth/logout?post_logout_redirect_uri=/.auth/login/aad',
    );
    expect(screen.getByRole('menuitem', { name: /Sign out of Microsoft too/ })).toBeInTheDocument();
  });
});
