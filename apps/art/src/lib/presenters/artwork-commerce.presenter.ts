import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { formatGbpPence } from "@auction/shop-portal/vm";

export type ArtworkCommerceFacts = Pick<
  PublicArtworkSummary,
  "saleState" | "eligibleForEditionAllocation" | "availability" | "printPricePence"
>;

export type ArtworkMetaFacts = Pick<PublicArtworkSummary, "yearCreated" | "medium" | "dimensions">;

/** Sold originals and fully claimed edition runs are both “Sold” on lax.art. */
export function isArtworkSold(artwork: ArtworkCommerceFacts): boolean {
  if (artwork.saleState === "sold") return true;
  return artwork.eligibleForEditionAllocation && artwork.availability.editionsAvailable <= 0;
}

/** lax.art sales are enquiry-led: every unsold work accepts an enquiry. */
export function isArtworkEnquiryAvailable(artwork: ArtworkCommerceFacts): boolean {
  return !isArtworkSold(artwork);
}

export function resolveArtworkPriceLabel(artwork: ArtworkCommerceFacts): string {
  if (isArtworkSold(artwork)) return "Sold";
  if (artwork.saleState === "for_sale" && artwork.printPricePence !== null) {
    return formatGbpPence(artwork.printPricePence);
  }
  return "Price on request";
}

/** “2024 · Oil on canvas · 40 × 50 cm”; null when the catalogue has no facts yet. */
export function formatArtworkMetaLine(artwork: ArtworkMetaFacts): string | null {
  const parts = [
    artwork.yearCreated !== null ? String(artwork.yearCreated) : null,
    artwork.medium,
    artwork.dimensions,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}
