import { ShopDomainError } from "./shop-domain-error.js";

export type FeaturedOriginalArtworkCandidate = {
  eligibleForEditionAllocation: boolean;
  saleState: string;
};

/** Home featured_originals slot must only surface one-of-one originals that are still offerable. */
export function assertFeaturedOriginalArtwork(artwork: FeaturedOriginalArtworkCandidate): void {
  if (artwork.eligibleForEditionAllocation) {
    throw new ShopDomainError(
      "featured_originals placements must reference originals, not edition artworks",
    );
  }
  if (artwork.saleState === "sold") {
    throw new ShopDomainError("featured_originals placements must not include sold works");
  }
}
