import type { HomePrintCard } from "@/content/home-marketing";
import { formatEditionAvailabilitySummary } from "@/lib/public-artwork-presenters";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

export const PRINTS_RAIL_TARGET_COUNT = 5;

export function catalogueItemToPrintCard(item: PublicArtworkSummary): HomePrintCard {
  return {
    id: `catalogue-${item.slug}`,
    image: item.imageUrl,
    imageAlt: `${item.title} by ${item.artistName}`,
    title: item.title,
    artist: item.artistName,
    medium: formatEditionAvailabilitySummary(item),
    href: `/artworks/${item.slug}`,
  };
}

export function buildPrintRailCards(catalogueItems: PublicArtworkSummary[]): HomePrintCard[] {
  return catalogueItems
    .filter((item) => item.eligibleForEditionAllocation)
    .slice(0, PRINTS_RAIL_TARGET_COUNT)
    .map(catalogueItemToPrintCard);
}
