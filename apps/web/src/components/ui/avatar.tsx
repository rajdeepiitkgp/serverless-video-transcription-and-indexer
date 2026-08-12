import { cn } from '@/lib/cn';

/*
 * Deterministic identity chip (plan §4): SWA built-in auth exposes no profile photo
 * (that needs a Graph token + custom app registration — ADR'd future option), so the
 * avatar is initials on a tape-label fill, both derived from `userDetails` alone.
 */

const AVATAR_FILLS = [
  'bg-avatar-1',
  'bg-avatar-2',
  'bg-avatar-3',
  'bg-avatar-4',
  'bg-avatar-5',
  'bg-avatar-6',
] as const;

/** Stable non-crypto hash so a user keeps one fill across sessions and devices. */
export function avatarFillIndex(userDetails: string): number {
  let hash = 0;
  for (const char of userDetails) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash % AVATAR_FILLS.length;
}

/** `ana.lima@example.com` → `AL`; single-word locals fall back to two letters. */
export function avatarInitials(userDetails: string): string {
  const local = userDetails.split('@')[0] ?? userDetails;
  const parts = local.split(/[\s._-]+/).filter((part) => part !== '');
  const first = parts[0]?.charAt(0) ?? '?';
  const second = parts.length > 1 ? (parts[1]?.charAt(0) ?? '') : (parts[0]?.charAt(1) ?? '');
  return `${first}${second}`.toUpperCase();
}

export function Avatar({
  userDetails,
  className,
}: {
  userDetails: string;
  className?: string;
}): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold text-accent-solid-fg select-none',
        AVATAR_FILLS[avatarFillIndex(userDetails)],
        className,
      )}
    >
      {avatarInitials(userDetails)}
    </span>
  );
}
