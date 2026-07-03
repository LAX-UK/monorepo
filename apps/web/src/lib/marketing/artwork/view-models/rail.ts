import { formatEstimateRange } from "@/lib/format-currency";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { salePath } from "@/lib/seo/url";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { normalizeAuctionTime } from "@auction/validators";
import { resolveLotHref, sortSaleLotsForNav } from "./shared";

export type LotRailCardVM = {
  id: string;
  href: string;
  imageUrl: string | null;
  lotNumber: number | null;
  title: string;
  artistOrSellerName: string;
  estimateLine: string | null;
  currentPrice: string;
  endTime: string | null;
  status: Lot["status"];
  sellerId: string;
  deliveryMode?: Sale["deliveryMode"] | null;
};

export type LotRelatedRailVM = {
  mode: "sale" | "seller";
  heading: string;
  viewAuctionHref: string | null;
  cards: LotRailCardVM[];
};

function lotToRailCard(
  lot: Lot,
  artistName: string,
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
    artistOrSellerName: artistName,
    estimateLine: est ? formatEstimateRange(est) : null,
    currentPrice: lot.currentPrice,
    endTime: normalizeAuctionTime(lot.endTime),
    status: lot.status,
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
  parentSale: { id: string; title: string; deliveryMode?: Sale["deliveryMode"] | null } | null,
  saleLots: Lot[] | null,
  sellerRelated: Lot[],
  resolveSellerName: (l: Lot) => string,
  catalogLinkParams?: CatalogLinkParams,
): LotRelatedRailVM {
  const saleSiblings = (saleLots ?? []).filter((l) => l.id !== lot.id);
  const useSale =
    Boolean(parentSale) && lot.saleId != null && saleSiblings.length >= MIN_SALE_SIBLINGS;

  const source = useSale
    ? sortSaleLotsForNav(saleSiblings).slice(0, 4)
    : sellerRelated.filter((l) => l.id !== lot.id).slice(0, 4);

  if (source.length === 0) {
    return { mode: useSale ? "sale" : "seller", heading: "", viewAuctionHref: null, cards: [] };
  }

  return {
    mode: useSale ? "sale" : "seller",
    heading: useSale && parentSale ? `More from ${parentSale.title}` : "More from this seller",
    viewAuctionHref: useSale && parentSale ? salePath(parentSale) : null,
    cards: source.map((l) =>
      lotToRailCard(
        l,
        resolveSellerName(l),
        catalogLinkParams,
        useSale && parentSale ? parentSale.deliveryMode : null,
      ),
    ),
  };
}
