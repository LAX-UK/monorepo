import type { PublicArtworkDetail } from "@auction/shop-contracts";

export type ArtworkUnavailableReason = "edition_sold_out" | "price_enquiry" | "sold";

export function isArtworkPurchasable(artwork: PublicArtworkDetail): boolean {
  return (
    artwork.saleState !== "price_on_application" &&
    artwork.saleState !== "sold" &&
    artwork.eligibleForEditionAllocation &&
    artwork.printPricePence !== null &&
    artwork.availability.state === "available"
  );
}

export function isArtworkPriceEnquiryAvailable(artwork: PublicArtworkDetail): boolean {
  if (!artwork.eligibleForEditionAllocation && artwork.saleState === "for_sale") {
    return true;
  }
  if (artwork.saleState !== "price_on_application") return false;
  if (artwork.eligibleForEditionAllocation && artwork.availability.state === "sold_out") {
    return false;
  }
  return true;
}

export function resolveArtworkUnavailableReason(
  artwork: PublicArtworkDetail,
): ArtworkUnavailableReason | null {
  if (isArtworkPurchasable(artwork)) return null;
  if (artwork.eligibleForEditionAllocation && artwork.availability.state === "sold_out") {
    return "edition_sold_out";
  }
  if (artwork.saleState === "sold") return "sold";
  if (isArtworkPriceEnquiryAvailable(artwork)) return "price_enquiry";
  return null;
}
