import type { HomePrintCard } from "@/content/home-marketing";
import { toCatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

export const PRINTS_RAIL_TARGET_COUNT = 5;

export function catalogueItemToPrintCard(item: PublicArtworkSummary): HomePrintCard {
  const card = toCatalogueArtworkCardVm(item);
  return {
    id: `catalogue-${item.slug}`,
    image: item.imageUrl,
    imageAlt: card.imageAlt,
    title: card.title,
    artist: card.artistName,
    medium: card.metaLine,
    href: card.href,
    ...(card.status !== null ? { status: card.status } : {}),
  };
}

export function buildPrintRailCards(catalogueItems: PublicArtworkSummary[]): HomePrintCard[] {
  return catalogueItems
    .filter((item) => item.eligibleForEditionAllocation)
    .slice(0, PRINTS_RAIL_TARGET_COUNT)
    .map(catalogueItemToPrintCard);
}
