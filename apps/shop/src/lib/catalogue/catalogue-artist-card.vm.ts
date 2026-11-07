import type { PublicArtistSummary } from "@auction/shop-contracts";

/** What an artist's tile shows: their portrait, else their lead edition, else initials alone. */
export type ArtistTileImage =
  | { kind: "portrait"; src: string }
  | { kind: "work"; src: string }
  | { kind: "initials" };

/** Portrait first; without one the artist's lead edition image; initials only when neither exists. */
export function chooseArtistTileImage(artist: {
  portraitUrl: string | null;
  leadImageUrl?: string | null | undefined;
}): ArtistTileImage {
  const portrait = artist.portraitUrl?.trim();
  if (portrait) return { kind: "portrait", src: portrait };
  const lead = artist.leadImageUrl?.trim();
  if (lead) return { kind: "work", src: lead };
  return { kind: "initials" };
}

export type CatalogueArtistCardVm = {
  id: string;
  /** The artist's portrait; null without one. */
  image: string | null;
  /** The lead edition's picture, shown whole when there is no portrait. */
  workImage: string | null;
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
  return items.map((item) => {
    const chosen = chooseArtistTileImage(item);
    return {
      id: `artist-${item.slug}`,
      image: chosen.kind === "portrait" ? chosen.src : null,
      workImage: chosen.kind === "work" ? chosen.src : null,
      imageAlt: `Portrait of ${item.name}`,
      name: item.name,
      initials: artistInitials(item.name),
      discipline: item.discipline,
      editionsLabel: formatEditionCount(item.artworkCount),
      href: `/artists/${item.slug}`,
    };
  });
}
