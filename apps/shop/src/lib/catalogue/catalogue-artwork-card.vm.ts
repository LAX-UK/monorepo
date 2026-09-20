import type { ShopStatusPresentation } from "@/lib/presenters/shop-status-presentation";
import { resolveArtworkSaleStatePresentation } from "@/lib/presenters/shop-status-presentation";
import { formatEditionAvailabilitySummary } from "@/lib/public-artwork-presenters";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

export type CatalogueArtworkCardVm = {
  slug: string;
  title: string;
  artistName: string;
  imageUrl: string | null;
  imageAlt: string;
  dimensions: string | null;
  status: ShopStatusPresentation | null;
  metaLine: string;
  href: string;
};

export function isCatalogueArtworkSoldOut(item: PublicArtworkSummary): boolean {
  if (item.saleState === "sold") return true;
  if (item.eligibleForEditionAllocation && item.availability.editionsAvailable <= 0) {
    return true;
  }
  return false;
}

/** Availability outranks price: sold-out editions and sold originals win over Price on request. */
export function resolveCatalogueArtworkCardBadge(
  item: PublicArtworkSummary,
): ShopStatusPresentation | null {
  if (isCatalogueArtworkSoldOut(item)) {
    return { label: "Sold out", tone: "neutral" };
  }
  if (item.saleState === "price_on_application") {
    return resolveArtworkSaleStatePresentation("price_on_application");
  }
  return null;
}

export function toCatalogueArtworkCardVm(item: PublicArtworkSummary): CatalogueArtworkCardVm {
  return {
    slug: item.slug,
    title: item.title,
    artistName: item.artistName,
    imageUrl: item.imageUrl,
    imageAlt: `${item.title} by ${item.artistName}`,
    dimensions: item.dimensions,
    status: resolveCatalogueArtworkCardBadge(item),
    metaLine: formatEditionAvailabilitySummary(item),
    href: `/artworks/${item.slug}`,
  };
}

export function buildCatalogueArtworkCards(
  items: PublicArtworkSummary[],
): CatalogueArtworkCardVm[] {
  return items.map(toCatalogueArtworkCardVm);
}
