import type { HomeArtistCard } from "@/content/home-marketing";
import { buildCatalogueArtistCards } from "@/lib/catalogue/catalogue-artist-card.vm";
import type { PublicArtistSummary } from "@auction/shop-contracts";

export function buildArtistRailCards(items: PublicArtistSummary[]): HomeArtistCard[] {
  return buildCatalogueArtistCards(items);
}
