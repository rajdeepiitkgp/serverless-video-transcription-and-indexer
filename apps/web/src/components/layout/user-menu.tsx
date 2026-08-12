'use client';

import Link from 'next/link';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/lib/auth/use-current-user';

const providerLabel = (identityProvider: string): string =>
  identityProvider === 'aad' ? 'Microsoft account' : identityProvider;

/**
 * User menu fed by `/.auth/me` (plan §4). Roles shown are always the caller's own —
 * that endpoint can never return anyone else's principal. "Switch account" clears
 * the SWA session and re-enters login; with a single active Microsoft session SSO
 * may silently sign the same account back in (documented caveat), which is what the
 * "Sign out of Microsoft too" escape hatch is for.
 */
export function UserMenu(): React.JSX.Element {
  const { status, user } = useCurrentUser();

  if (status === 'loading') {
    return <span aria-hidden className="size-8 rounded-sm bg-raised motion-safe:animate-pulse" />;
  }

  if (status === 'anonymous') {
    return (
      <Button asChild variant="secondary" size="sm">
        <a href="/.auth/login/aad">Sign in</a>
      </Button>
    );
  }

  const roles = user.userRoles.filter((role) => role !== 'anonymous');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account: ${user.userDetails}`}
        className="cursor-pointer rounded-sm transition-opacity duration-150 hover:opacity-85"
      >
        <Avatar userDetails={user.userDetails} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-fg">{user.userDetails}</p>
          <p className="mt-0.5 font-mono text-xs text-fg-faint">
            {providerLabel(user.identityProvider)}
          </p>
          {roles.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-1">
              {roles.map((role) => (
                <Badge key={role} variant={role === 'admin' ? 'accent' : 'neutral'}>
                  {role}
                </Badge>
              ))}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/docs/">API docs</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/.auth/logout">Sign out</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/.auth/logout?post_logout_redirect_uri=/.auth/login/aad">Switch account</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href="https://login.microsoftonline.com/common/oauth2/v2.0/logout"
            title="Use this when switching accounts silently signs the same account back in"
          >
            Sign out of Microsoft too
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
