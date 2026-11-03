import {
  type CatalogueArtistCardSource,
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import { marketingArtistFactsLine, marketingRowLayout } from "@auction/marketing-ui";
import type { PublicArtistDetail } from "@auction/shop-contracts";

/** How many featured artists the home reads; the rail beyond two scrolls through them. */
export const FEATURED_ARTISTS_LIMIT = 6;

/** One artist, told at length: facts, a short bio and the way to their work. */
export type FeaturedArtistSoloVm = {
  card: CatalogueArtistCardVm;
  /** "British · b. 1979 · Painter"; null when nothing is catalogued. */
  factsLine: string | null;
  shortBio: string | null;
};

/** A row in the pair: the facts line is the discipline, as the pair has no room for more. */
export type FeaturedArtistPairItemVm = {
  card: CatalogueArtistCardVm;
  factsLine: string | null;
};

/**
 * One artist is a feature, two a pair, three or more the shared rail; none hides the section.
 * The rail needs three to read as one, so the forms below it never leave a half-empty row.
 */
export type FeaturedArtistsVm =
  | { layout: "feature"; solo: FeaturedArtistSoloVm }
  | { layout: "pair"; items: FeaturedArtistPairItemVm[] }
  | { layout: "rail"; cards: CatalogueArtistCardVm[] };

/** Whether a single featured artist needs its detail (nationality, years, short bio) read. */
export function featuredArtistNeedsDetail(count: number): boolean {
  return marketingRowLayout(count) === "feature";
}

function factsLine(
  source: CatalogueArtistCardSource,
  detail: PublicArtistDetail | null,
): string | null {
  return marketingArtistFactsLine({
    discipline: source.discipline,
    nationality: detail?.nationality ?? source.nationality,
    birthYear: detail?.birthYear ?? source.birthYear,
    deathYear: detail?.deathYear ?? source.deathYear,
  });
}

export function buildFeaturedArtists(input: {
  artists: readonly CatalogueArtistCardSource[];
  followedSlugs?: ReadonlySet<string>;
  /** The detail of the only artist, when there is one; ignored otherwise. */
  soloDetail?: PublicArtistDetail | null;
}): FeaturedArtistsVm | null {
  const layout = marketingRowLayout(input.artists.length);
  if (layout === null) return null;
  const cards = buildCatalogueArtistCards(input.artists, input.followedSlugs);
  const first = input.artists[0];
  const firstCard = cards[0];
  if (layout === "feature" && first && firstCard) {
    const detail = input.soloDetail?.slug === first.slug ? input.soloDetail : null;
    return {
      layout,
      solo: {
        card: firstCard,
        factsLine: factsLine(first, detail),
        shortBio: detail?.shortBio?.trim() || null,
      },
    };
  }
  if (layout === "pair") {
    return {
      layout,
      items: cards.map((card, index) => ({
        card,
        factsLine: input.artists[index]?.discipline?.trim() || null,
      })),
    };
  }
  return { layout: "rail", cards };
}
