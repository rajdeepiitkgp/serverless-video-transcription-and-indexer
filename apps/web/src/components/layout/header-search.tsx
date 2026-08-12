'use client';

import { useRouter } from 'next/navigation';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

/** Header search box (plan §4) — submits to /search, which owns the results view. */
export function HeaderSearch({ className }: { className?: string }): React.JSX.Element {
  const router = useRouter();
  return (
    <form
      role="search"
      className={cn('w-56', className)}
      onSubmit={(event) => {
        event.preventDefault();
        const query = new FormData(event.currentTarget).get('q');
        if (typeof query === 'string' && query.trim() !== '') {
          router.push(`/search/?q=${encodeURIComponent(query.trim())}`);
        }
      }}
    >
      <Input
        type="search"
        name="q"
        placeholder="Search transcripts…"
        aria-label="Search transcripts"
        className="h-8 text-xs"
      />
    </form>
  );
}
