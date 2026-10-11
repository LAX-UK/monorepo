import { artistHref } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { PortalFollowedArtist, PublicArtistSummary } from "@auction/shop-contracts";

export type CatalogueArtistCardVm = {
  slug: string;
  image: string | null;
  imageAlt: string;
  name: string;
  /** Discipline or works count; null hides the line. */
  caption: string | null;
  href: string;
};

function worksCaption(count: number): string {
  return `${count} work${count === 1 ? "" : "s"}`;
}

export function buildCatalogueArtistCards(
  items: readonly PublicArtistSummary[],
): CatalogueArtistCardVm[] {
  return items.map((item) => ({
    slug: item.slug,
    image: item.portraitUrl,
    imageAlt: `Portrait of ${item.name}`,
    name: item.name,
    caption: item.discipline ?? worksCaption(item.artworkCount),
    href: artistHref(item.slug),
  }));
}

export function buildFollowedArtistCards(
  items: readonly PortalFollowedArtist[],
): CatalogueArtistCardVm[] {
  return items.map((item) => ({
    slug: item.artistSlug,
    image: item.portraitUrl,
    imageAlt: `Portrait of ${item.artistName}`,
    name: item.artistName,
    caption: null,
    href: artistHref(item.artistSlug),
  }));
}
