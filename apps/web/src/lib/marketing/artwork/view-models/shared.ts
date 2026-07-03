import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import { lotPath } from "@/lib/seo/url";
import type { Lot, PublicLotView } from "@auction/types";

export function sortSaleLotsForNav(lots: Lot[]): Lot[] {
  return [...lots].sort((a, b) => {
    const an = a.lotNumber;
    const bn = b.lotNumber;
    if (an != null && bn != null) return an - bn;
    if (an != null) return -1;
    if (bn != null) return 1;
    return a.title.localeCompare(b.title);
  });
}

export function resolveLotHref(
  lot: Lot | PublicLotView,
  catalogLinkParams?: CatalogLinkParams,
): string {
  return catalogLinkParams ? lotCatalogHref(lot, catalogLinkParams) : lotPath(lot);
}
