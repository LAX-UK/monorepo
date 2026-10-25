import { artistHref } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type {
  PortalFollowedArtist,
  PublicArtistDetail,
  PublicArtistSummary,
} from "@auction/shop-contracts";

export type CatalogueArtistCardVm = {
  slug: string;
  image: string | null;
  imageAlt: string;
  name: string;
  /** Nationality and years, else discipline or works count; null hides the line. */
  caption: string | null;
  href: string;
  /** "3 works" on lax.art; null when unknown or none. */
  worksLabel: string | null;
  /** Seeds the Follow button; guests always start unfollowed. */
  following: boolean;
};

/** Summaries from list reads; detail reads (editorial rails) also carry nationality and years. */
export type CatalogueArtistCardSource = PublicArtistSummary &
  Partial<Pick<PublicArtistDetail, "nationality" | "birthYear" | "deathYear">>;

const NO_SLUGS: ReadonlySet<string> = new Set();

function worksCaption(count: number): string {
  return `${count} work${count === 1 ? "" : "s"}`;
}

function lifeYears(birthYear: number | null, deathYear: number | null): string | null {
  if (birthYear !== null && deathYear !== null) return `${birthYear}–${deathYear}`;
  if (birthYear !== null) return `b. ${birthYear}`;
  return null;
}

/** “British, 1924–2001”, “British”, “b. 1960”; null when the record has neither. */
export function formatArtistLifeLine(item: CatalogueArtistCardSource): string | null {
  const parts = [
    item.nationality?.trim() || null,
    lifeYears(item.birthYear ?? null, item.deathYear ?? null),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

export function buildCatalogueArtistCards(
  items: readonly CatalogueArtistCardSource[],
  followedSlugs: ReadonlySet<string> = NO_SLUGS,
): CatalogueArtistCardVm[] {
  return items.map((item) => ({
    slug: item.slug,
    image: item.portraitUrl,
    imageAlt: `Portrait of ${item.name}`,
    name: item.name,
    caption: formatArtistLifeLine(item) ?? item.discipline ?? worksCaption(item.artworkCount),
    worksLabel: item.artworkCount > 0 ? worksCaption(item.artworkCount) : null,
    href: artistHref(item.slug),
    following: followedSlugs.has(item.slug),
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
    worksLabel: null,
    href: artistHref(item.artistSlug),
    following: true,
  }));
}
