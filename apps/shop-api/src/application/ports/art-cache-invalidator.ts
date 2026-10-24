/** What changed in the catalogue: artworks only, or an artist (and so their artworks too). */
export type ArtCatalogueScope = "artworks" | "artists";

/**
 * Tells lax.art that published content changed so it can drop its cached copy.
 * Implementations reject when the notification could not be delivered; callers decide
 * whether that matters (for staff writes it never does, lax.art's own expiry is the fallback).
 */
export interface ArtCacheInvalidator {
  invalidateEditorial(): Promise<void>;
  /** Catalogue lists and the editorial pages that show artworks. */
  invalidateCatalogue(scope: ArtCatalogueScope): Promise<void>;
}
