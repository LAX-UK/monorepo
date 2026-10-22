/**
 * Tells lax.art that published editorial content changed so it can drop its cached copy.
 * Implementations reject when the notification could not be delivered; callers decide
 * whether that matters (for staff writes it never does, lax.art's own expiry is the fallback).
 */
export interface ArtCacheInvalidator {
  invalidateEditorial(): Promise<void>;
}
