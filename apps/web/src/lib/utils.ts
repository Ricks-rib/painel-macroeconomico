import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Une classes resolvendo conflitos do Tailwind (a ultima vence de verdade).
 * Sem isto, `cn('p-2', 'p-4')` geraria as duas e o resultado dependeria da
 * ordem no CSS final.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
