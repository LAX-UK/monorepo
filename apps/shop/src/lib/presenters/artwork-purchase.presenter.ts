import { EDITION_PAGE_COPY } from "@/content/artwork-edition-copy";
import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { formatGbpPenceForDisplay } from "@auction/shop-portal/vm";

/** The buy block's money: what it costs and whether it can still be bought. */
export type ArtworkPurchaseVm = {
  /** "£120", whole pounds as on every display page; prices include VAT. */
  priceLabel: string;
  vatNote: string;
  availability: "available" | "sold_out";
};

export function presentArtworkPurchase(artwork: PublicArtworkDetail): ArtworkPurchaseVm | null {
  if (artwork.printPricePence === null) return null;
  const soldOut = artwork.saleState === "sold" || artwork.availability.state === "sold_out";
  return {
    priceLabel: formatGbpPenceForDisplay(artwork.printPricePence),
    vatNote: EDITION_PAGE_COPY.vatNote,
    availability: soldOut ? "sold_out" : "available",
  };
}
