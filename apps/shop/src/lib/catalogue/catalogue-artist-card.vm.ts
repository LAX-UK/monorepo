import type { PublicArtistSummary } from "@auction/shop-contracts";

export type CatalogueArtistCardVm = {
  id: string;
  image: string | null;
  imageAlt: string;
  name: string;
  discipline: string;
  href: string;
};

export function buildCatalogueArtistCards(items: PublicArtistSummary[]): CatalogueArtistCardVm[] {
  return items.map((item) => ({
    id: `artist-${item.slug}`,
    image: item.portraitUrl,
    imageAlt: item.name,
    name: item.name,
    discipline: item.discipline ?? "Artist",
    href: `/artists/${item.slug}`,
  }));
}
