import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { salePath } from "@/lib/seo/url";
import type { Lot, PublicLotView } from "@auction/types";
import { resolveLotHref, sortSaleLotsForNav } from "./shared";

export type LotHeroVM = {
  firstSegmentHref: string;
  firstSegmentLabel: string;
  saleHref: string | null;
  saleTitle: string | null;
  lotNumberLabel: string | null;
  prevHref: string | null;
  nextHref: string | null;
  /** e.g. "1 / 8" when navigating within a sale; null if unknown */
  positionLabel: string | null;
  /** Optional Home segment prepended to the breadcrumb so the trail reads
   * Home › Sale › Lot N (mockup parity). When omitted the breadcrumb keeps
   * the historical "Auctions" first crumb behaviour.
   */
  homeSegment?: { label: string; href: string };
};

/** Breadcrumb + prev/next within the current sale (when `saleId` and lots are known).
 */
export function mapLotToHeroVM(
  lot: Lot | PublicLotView,
  parentSale: { id: string; title: string } | null,
  saleLots: Lot[] | null,
  catalogLinkParams?: CatalogLinkParams,
): LotHeroVM {
  const firstSegmentHref = "/sales";
  const firstSegmentLabel = "Auctions";

  const homeSegment = { label: "Home", href: "/" } as const;

  if (!parentSale || !lot.saleId) {
    return {
      firstSegmentHref,
      firstSegmentLabel,
      saleHref: null,
      saleTitle: null,
      lotNumberLabel: lot.lotNumber != null ? `LOT ${lot.lotNumber}` : null,
      prevHref: null,
      nextHref: null,
      positionLabel: null,
      homeSegment,
    };
  }

  const ordered = sortSaleLotsForNav(saleLots?.filter((l) => l.saleId === lot.saleId) ?? []);
  const idx = ordered.findIndex((l) => l.id === lot.id);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const positionLabel = idx >= 0 && ordered.length > 0 ? `${idx + 1} / ${ordered.length}` : null;

  return {
    firstSegmentHref,
    firstSegmentLabel,
    saleHref: salePath(parentSale),
    saleTitle: parentSale.title,
    lotNumberLabel:
      lot.lotNumber != null
        ? `LOT ${lot.lotNumber}`
        : `LOT ${lot.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    prevHref: prev ? resolveLotHref(prev, catalogLinkParams) : null,
    nextHref: next ? resolveLotHref(next, catalogLinkParams) : null,
    positionLabel,
    homeSegment,
  };
}
