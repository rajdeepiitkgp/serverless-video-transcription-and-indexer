import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind class lists with conflict resolution (docs/style-guide.md). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
