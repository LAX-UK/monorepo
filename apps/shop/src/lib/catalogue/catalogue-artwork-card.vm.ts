import type { ShopStatusPresentation } from "@/lib/presenters/shop-status-presentation";
import { formatEditionAvailabilitySummary } from "@/lib/public-artwork-presenters";
import type { PublicArtworkSummary } from "@auction/shop-contracts";
import { formatGbpPence } from "@auction/shop-portal/vm";

export type CatalogueArtworkCardVm = {
  slug: string;
  title: string;
  artistName: string;
  artistSlug: string;
  imageUrl: string | null;
  imageAlt: string;
  dimensions: string | null;
  status: ShopStatusPresentation | null;
  metaLine: string;
  href: string;
};

export function isCatalogueArtworkSoldOut(item: PublicArtworkSummary): boolean {
  if (item.saleState === "sold") return true;
  if (item.eligibleForEditionAllocation && item.availability.state === "sold_out") {
    return true;
  }
  return false;
}

/** Sold-out editions carry a badge; available editions have none. */
export function resolveCatalogueArtworkCardBadge(
  item: PublicArtworkSummary,
): ShopStatusPresentation | null {
  if (isCatalogueArtworkSoldOut(item)) {
    return { label: "Sold out", tone: "neutral" };
  }
  return null;
}

function formatCatalogueCardMetaLine(item: PublicArtworkSummary): string {
  const availability = formatEditionAvailabilitySummary(item);
  if (item.saleState === "for_sale" && item.printPricePence !== null) {
    return `${formatGbpPence(item.printPricePence)} · ${availability}`;
  }
  return availability;
}

export function toCatalogueArtworkCardVm(item: PublicArtworkSummary): CatalogueArtworkCardVm {
  return {
    slug: item.slug,
    title: item.title,
    artistName: item.artistName,
    artistSlug: item.artistSlug,
    imageUrl: item.imageUrl,
    imageAlt: `${item.title} by ${item.artistName}`,
    dimensions: item.dimensions,
    status: resolveCatalogueArtworkCardBadge(item),
    metaLine: formatCatalogueCardMetaLine(item),
    href: `/artworks/${item.slug}`,
  };
}

export function buildCatalogueArtworkCards(
  items: PublicArtworkSummary[],
): CatalogueArtworkCardVm[] {
  return items.map(toCatalogueArtworkCardVm);
}
