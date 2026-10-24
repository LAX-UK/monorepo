import type { PublicArtworkDetail } from "@auction/shop-contracts";

export type ArtworkUnavailableReason = "edition_sold_out" | "sold";

export function isArtworkPurchasable(artwork: PublicArtworkDetail): boolean {
  return (
    artwork.saleState !== "price_on_application" &&
    artwork.saleState !== "sold" &&
    artwork.eligibleForEditionAllocation &&
    artwork.printPricePence !== null &&
    artwork.availability.state === "available"
  );
}

export function resolveArtworkUnavailableReason(
  artwork: PublicArtworkDetail,
): ArtworkUnavailableReason | null {
  if (isArtworkPurchasable(artwork)) return null;
  if (artwork.eligibleForEditionAllocation && artwork.availability.state === "sold_out") {
    return "edition_sold_out";
  }
  if (artwork.saleState === "sold") return "sold";
  return null;
}
