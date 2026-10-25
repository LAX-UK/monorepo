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
  /** "Limited edition of 24", or null when the size is not catalogued. */
  editionLine: string | null;
  /** The price incl. VAT, or "Sold out" in its place; a card states its status once. */
  priceLine: string | null;
  soldOut: boolean;
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

function formatCatalogueCardPriceLine(item: PublicArtworkSummary): string | null {
  if (isCatalogueArtworkSoldOut(item)) return "Sold out";
  return item.printPricePence !== null ? formatGbpPence(item.printPricePence) : null;
}

export function toCatalogueArtworkCardVm(item: PublicArtworkSummary): CatalogueArtworkCardVm {
  const { totalEditions } = item.availability;
  return {
    slug: item.slug,
    title: item.title,
    artistName: item.artistName,
    artistSlug: item.artistSlug,
    imageUrl: item.imageUrl,
    imageAlt: `${item.title} by ${item.artistName}`,
    dimensions: item.dimensions,
    status: resolveCatalogueArtworkCardBadge(item),
    editionLine: totalEditions > 0 ? `Limited edition of ${totalEditions}` : null,
    priceLine: formatCatalogueCardPriceLine(item),
    soldOut: isCatalogueArtworkSoldOut(item),
    metaLine: formatCatalogueCardMetaLine(item),
    href: `/artworks/${item.slug}`,
  };
}

export function buildCatalogueArtworkCards(
  items: PublicArtworkSummary[],
): CatalogueArtworkCardVm[] {
  return items.map(toCatalogueArtworkCardVm);
}
