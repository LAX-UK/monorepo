import type { PublicArtworkDetail } from "@auction/shop-contracts";
import { FULFILMENT_SURCHARGE_PENCE } from "@auction/shop-domain";
import { formatGbpPence } from "@auction/shop-portal/vm";

/** The buy block's copy: what it costs, how it arrives, and how to change your mind. */
export type ArtworkPurchaseVm = {
  /** "£120.00"; prices include VAT. */
  priceLabel: string;
  vatNote: string;
  /** "Limited edition of 24", never a remaining count. */
  editionSize: string;
  /** "Edition of 24", for the phone buy bar where space is short. */
  editionShort: string;
  availability: "available" | "sold_out";
  availabilityLabel: string;
  deliveryLine: string;
  returnsLine: string;
};

const LONDON_COLLECTION_OPTIONS = ["collect_new_cavendish", "collect_brunswick"] as const;

/**
 * "UK insured delivery £15.00 · Collection in London free", from the surcharges checkout charges,
 * so the product page and checkout never disagree.
 */
export function shopDeliveryLine(): string {
  const delivery = formatGbpPence(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery);
  const collection = Math.min(
    ...LONDON_COLLECTION_OPTIONS.map((option) => FULFILMENT_SURCHARGE_PENCE[option]),
  );
  const collectionLabel = collection === 0 ? "free" : `from ${formatGbpPence(collection)}`;
  return `UK insured delivery ${delivery} · Collection in London ${collectionLabel}`;
}

/** The statutory 14-day right to cancel an online order (Consumer Contracts Regulations). */
export const SHOP_RETURNS_LINE = "14-day cancellation";

export function editionSizeLabel(artwork: Pick<PublicArtworkDetail, "availability">): string {
  const { totalEditions } = artwork.availability;
  return totalEditions > 0 ? `Limited edition of ${totalEditions}` : "Limited edition";
}

export function presentArtworkPurchase(artwork: PublicArtworkDetail): ArtworkPurchaseVm | null {
  if (artwork.printPricePence === null) return null;
  const soldOut = artwork.saleState === "sold" || artwork.availability.state === "sold_out";
  return {
    priceLabel: formatGbpPence(artwork.printPricePence),
    vatNote: "Includes VAT",
    editionSize: editionSizeLabel(artwork),
    editionShort:
      artwork.availability.totalEditions > 0
        ? `Edition of ${artwork.availability.totalEditions}`
        : "Limited edition",
    availability: soldOut ? "sold_out" : "available",
    availabilityLabel: soldOut ? "Sold out" : "Available",
    deliveryLine: shopDeliveryLine(),
    returnsLine: SHOP_RETURNS_LINE,
  };
}

/** "Included" with every edition; the certificate line only when the work has one. */
export function artworkIncludedItems(
  artwork: Pick<PublicArtworkDetail, "hasCertificate">,
): string[] {
  return [
    ...(artwork.hasCertificate ? ["Certificate of authenticity"] : []),
    "Professional packaging",
    "Insured UK delivery or collection in London",
    "Edition number assigned when your order is fulfilled",
  ];
}
