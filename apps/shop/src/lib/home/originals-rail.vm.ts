import type { HomeOriginalCard } from "@/content/home-marketing";
import { toCatalogueArtworkCardVm } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

export function buildOriginalRailCards(items: PublicArtworkSummary[]): HomeOriginalCard[] {
  return items.map((item) => {
    const card = toCatalogueArtworkCardVm(item);
    return {
      id: `catalogue-${card.slug}`,
      image: item.imageUrl,
      imageAlt: `${card.title} by ${card.artistName}`,
      title: card.title,
      artistLine: item.yearCreated ? `${card.artistName} (${item.yearCreated})` : card.artistName,
      dimensions: item.dimensions ?? "",
      availabilityNote: card.metaLine,
      href: card.href,
      ...(card.status !== null ? { status: card.status } : {}),
    };
  });
}
