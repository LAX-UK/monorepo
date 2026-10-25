import type { PublicArtistSummary } from "@auction/shop-contracts";

export type CatalogueArtistCardVm = {
  id: string;
  image: string | null;
  imageAlt: string;
  name: string;
  /** Up to two initials, shown on the mat when there is no portrait. */
  initials: string;
  discipline: string | null;
  /** "3 editions"; null when the count is not above zero. */
  editionsLabel: string | null;
  href: string;
};

export function artistInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function formatEditionCount(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 edition" : `${count} editions`;
}

export function buildCatalogueArtistCards(items: PublicArtistSummary[]): CatalogueArtistCardVm[] {
  return items.map((item) => ({
    id: `artist-${item.slug}`,
    image: item.portraitUrl,
    imageAlt: `Portrait of ${item.name}`,
    name: item.name,
    initials: artistInitials(item.name),
    discipline: item.discipline,
    editionsLabel: formatEditionCount(item.artworkCount),
    href: `/artists/${item.slug}`,
  }));
}
