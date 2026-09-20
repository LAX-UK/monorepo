import type { PublicArtworkDetail } from "@auction/shop-contracts";

export type ArtworkUnavailableReason = "edition_sold_out" | "price_enquiry" | "sold";

export function isArtworkPurchasable(artwork: PublicArtworkDetail): boolean {
  return (
    artwork.saleState !== "price_on_application" &&
    artwork.saleState !== "sold" &&
    artwork.eligibleForEditionAllocation &&
    artwork.printPricePence !== null &&
    artwork.availability.editionsAvailable > 0
  );
}

export function isArtworkPriceEnquiryAvailable(artwork: PublicArtworkDetail): boolean {
  if (artwork.saleState !== "price_on_application") return false;
  if (artwork.eligibleForEditionAllocation && artwork.availability.editionsAvailable <= 0) {
    return false;
  }
  return true;
}

export function resolveArtworkUnavailableReason(
  artwork: PublicArtworkDetail,
): ArtworkUnavailableReason | null {
  if (isArtworkPurchasable(artwork)) return null;
  if (artwork.eligibleForEditionAllocation && artwork.availability.editionsAvailable <= 0) {
    return "edition_sold_out";
  }
  if (artwork.saleState === "sold") return "sold";
  if (isArtworkPriceEnquiryAvailable(artwork)) return "price_enquiry";
  return null;
}
