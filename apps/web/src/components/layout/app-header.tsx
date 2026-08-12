import Link from 'next/link';

import { HeaderSearch } from '@/components/layout/header-search';
import { MainNav } from '@/components/layout/main-nav';
import { UserMenu } from '@/components/layout/user-menu';
import { ThemeToggle } from '@/components/theme/theme-toggle';

/**
 * Console masthead. The amber square is the record light — the one always-on trace
 * of the accent in the chrome. Nav collapses to a second scrollable row on small
 * screens; the search box yields to the /search page there.
 */
export function AppHeader(): React.JSX.Element {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-7">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span aria-hidden className="size-2 bg-accent-solid" />
            {/* tracking-[0.25em]: wordmark letterspacing; the widest tracking token (0.1em)
                reads as body text, not a masthead. */}
            <span className="font-display text-sm font-semibold tracking-[0.25em]">SIGNAL</span>
          </Link>
          <MainNav className="hidden md:flex" />
        </div>
        <div className="flex items-center gap-2.5">
          <HeaderSearch className="hidden lg:block" />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <div className="border-t border-line md:hidden">
        <MainNav className="mx-auto h-10 w-full max-w-6xl overflow-x-auto px-4 sm:px-6" />
      </div>
    </header>
  );
}
