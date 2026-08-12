'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/', label: 'CONSOLE' },
  { href: '/upload/', label: 'UPLOAD' },
  { href: '/videos/', label: 'LIBRARY' },
  { href: '/search/', label: 'SEARCH' },
  { href: '/docs/', label: 'API DOCS' },
] as const;

/**
 * Channel-button nav: mono caps like the rest of the console chrome, the active
 * route underlined in amber. `/videos/` stays lit on the watch page — you're still
 * in the library.
 */
export function MainNav({ className }: { className?: string }): React.JSX.Element {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn('flex items-center gap-5', className)}>
      {LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 border-b-2 py-1 font-mono text-xs tracking-wide transition-colors duration-150',
              active
                ? 'border-accent-solid text-accent'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
