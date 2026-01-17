'use client';

import { useMediaQuery } from './useMediaQuery';

/**
 * Hook to detect if the user prefers reduced motion
 * Respects the prefers-reduced-motion media query
 * @returns boolean indicating if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
