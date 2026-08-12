import Link from 'next/link';

import { ThemeToggle } from '@/components/theme/theme-toggle';

/**
 * Console masthead. The amber square is the record light — the one always-on trace
 * of the accent in the chrome. Nav, search, and the user menu land with the rest of
 * M4 after the design sign-off.
 */
export function AppHeader(): React.JSX.Element {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span aria-hidden className="size-2 bg-accent-solid" />
          {/* tracking-[0.25em]: wordmark letterspacing; the widest tracking token (0.1em)
              reads as body text, not a masthead. */}
          <span className="font-display text-sm font-semibold tracking-[0.25em]">SIGNAL</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
