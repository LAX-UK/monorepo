import { formatEstimateRange } from "@/lib/format-currency";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { salePath } from "@/lib/seo/url";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { resolveLotHref, sortSaleLotsForNav } from "./shared";

export type LotRailCardVM = {
  id: string;
  href: string;
  imageUrl: string | null;
  lotNumber: number | null;
  title: string;
  /** The lot's artist, or `null` when it is not known. The consignor is never shown here. */
  artistName: string | null;
  estimateLine: string | null;
  /**
   * The lot's sale, so the browser can read its live state (CO-7). The card carries no bid state
   * (price, label, status, close, result): the rail is built from cached reads, and the browser
   * fills these from a no-store read of the same sale catalogue (`useLotRailLive`).
   */
  saleId: string | null;
  sellerId: string;
  deliveryMode?: Sale["deliveryMode"] | null;
};

export type LotRelatedRailVM = {
  mode: "sale" | "seller";
  heading: string;
  viewAuctionHref: string | null;
  cards: LotRailCardVM[];
  /** The sale's premium, so a sold lot reads the buyer's price in the live fill. */
  premiumSale: Pick<Sale, "buyerPremiumRate" | "buyerPremiumTiers"> | null;
};

function lotToRailCard(
  lot: Lot,
  artistName: string | null,
  catalogLinkParams?: CatalogLinkParams,
  deliveryMode?: Sale["deliveryMode"] | null,
): LotRailCardVM {
  const est = lot.marketingDetails.estimate;
  return {
    id: lot.id,
    href: resolveLotHref(lot, catalogLinkParams),
    imageUrl: lot.images[0] ?? null,
    lotNumber: lot.lotNumber,
    title: lot.title,
    artistName,
    estimateLine: est ? formatEstimateRange(est) : null,
    saleId: lot.saleId ?? null,
    sellerId: lot.sellerId ?? lot.sellerLegalEntityId ?? "",
    deliveryMode: deliveryMode ?? null,
  };
}

const MIN_SALE_SIBLINGS = 1;

/** Prefers other lots from the same sale; falls back to the seller’s active list when the sale
 * is missing or has too few peers.
 */
export function mapSiblingsToRailVM(
  lot: Lot | PublicLotView,
  parentSale: {
    id: string;
    title: string;
    deliveryMode?: Sale["deliveryMode"] | null;
    buyerPremiumRate?: Sale["buyerPremiumRate"];
    buyerPremiumTiers?: Sale["buyerPremiumTiers"];
  } | null,
  saleLots: Lot[] | null,
  sellerRelated: Lot[],
  resolveArtistName: (l: Lot) => string | null,
  catalogLinkParams?: CatalogLinkParams,
): LotRelatedRailVM {
  const saleSiblings = (saleLots ?? []).filter((l) => l.id !== lot.id);
  const useSale =
    Boolean(parentSale) && lot.saleId != null && saleSiblings.length >= MIN_SALE_SIBLINGS;

  const source = useSale
    ? sortSaleLotsForNav(saleSiblings).slice(0, 4)
    : sellerRelated.filter((l) => l.id !== lot.id).slice(0, 4);

  if (source.length === 0) {
    return {
      mode: useSale ? "sale" : "seller",
      heading: "",
      viewAuctionHref: null,
      cards: [],
      premiumSale: null,
    };
  }

  return {
    mode: useSale ? "sale" : "seller",
    heading: useSale && parentSale ? `More from ${parentSale.title}` : "More from this seller",
    viewAuctionHref: useSale && parentSale ? salePath(parentSale) : null,
    premiumSale:
      useSale && parentSale?.buyerPremiumRate !== undefined
        ? {
            buyerPremiumRate: parentSale.buyerPremiumRate,
            buyerPremiumTiers: parentSale.buyerPremiumTiers ?? null,
          }
        : null,
    cards: source.map((l) =>
      lotToRailCard(
        l,
        resolveArtistName(l),
        catalogLinkParams,
        useSale && parentSale ? parentSale.deliveryMode : null,
      ),
    ),
  };
}
