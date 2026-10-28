import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
  formatEditionCount,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import { marketingArtistFactsLine } from "@auction/marketing-ui";
import type { PublicArtistDetail, PublicArtistSummary } from "@auction/shop-contracts";

/** The home page shows at most this many artists; the rest are one link away. */
export const HOME_ARTISTS_MAX = 8;

/**
 * How the artists section composes for its count, so it never leaves a row mostly empty: one
 * artist is a feature, two a pair, three or four a row, and from five a rail.
 */
export type HomeArtistsLayout = "feature" | "pair" | "row" | "rail";

const LAYOUT_BY_COUNT: ReadonlyArray<readonly [maxCount: number, layout: HomeArtistsLayout]> = [
  [1, "feature"],
  [2, "pair"],
  [4, "row"],
  [HOME_ARTISTS_MAX, "rail"],
];

/** `null` when there is no artist to show: the section hides. */
export function homeArtistsLayout(count: number): HomeArtistsLayout | null {
  if (count <= 0) return null;
  return LAYOUT_BY_COUNT.find(([maxCount]) => count <= maxCount)?.[1] ?? "rail";
}

/**
 * The artists the home page shows: staff-featured artists first, in their order, then the
 * others by their newest edition. Both lists hold only artists with an edition on sale, so the
 * section never goes stale; an artist appears once.
 */
export function chooseHomeArtists(
  featured: readonly PublicArtistSummary[],
  newest: readonly PublicArtistSummary[],
  max: number = HOME_ARTISTS_MAX,
): PublicArtistSummary[] {
  const chosen: PublicArtistSummary[] = [];
  const seen = new Set<string>();
  for (const artist of [...featured, ...newest]) {
    if (chosen.length >= max) break;
    if (seen.has(artist.slug) || artist.artworkCount <= 0) continue;
    seen.add(artist.slug);
    chosen.push(artist);
  }
  return chosen;
}

/** The one artist, told at length: facts, a short bio and both doors. */
export type HomeSoloArtistVm = {
  card: CatalogueArtistCardVm;
  /** "Painter · British, b. 1979"; null when nothing is catalogued. */
  factsLine: string | null;
  shortBio: string | null;
  /** "4 editions in the Shop". */
  countLabel: string | null;
  editionsLink: { label: string; href: string };
  /** The artist's profile on lax.art; null when lax.art is not linked. */
  profileHref: string | null;
};

export type HomeArtistsVm = {
  layout: HomeArtistsLayout;
  cards: CatalogueArtistCardVm[];
  /** "All 12 artists" beside the title of a row or rail; null for a feature or a pair. */
  viewAll: { label: string; href: string } | null;
  /** lax.art's artist directory, where the full stories are; null when lax.art is not linked. */
  laxArtHref: string | null;
  solo: HomeSoloArtistVm | null;
};

function artUrl(artBaseUrl: URL | null, path: string): string | null {
  return artBaseUrl ? new URL(path, artBaseUrl).toString() : null;
}

function buildSolo(
  card: CatalogueArtistCardVm,
  artist: PublicArtistSummary,
  detail: PublicArtistDetail | null,
  artBaseUrl: URL | null,
): HomeSoloArtistVm {
  const editions = formatEditionCount(artist.artworkCount);
  const profile = detail?.slug === artist.slug ? detail : null;
  return {
    card,
    factsLine: marketingArtistFactsLine({
      discipline: artist.discipline,
      nationality: profile?.nationality,
      birthYear: profile?.birthYear,
      deathYear: profile?.deathYear,
    }),
    shortBio: profile?.shortBio?.trim() || null,
    countLabel: editions ? `${editions} in the Shop` : null,
    editionsLink: { label: `Editions by ${artist.name}`, href: card.href },
    profileHref: artUrl(artBaseUrl, `/artists/${encodeURIComponent(artist.slug)}`),
  };
}

/**
 * The artists section, laid out for its count. `total` is every artist with an edition on sale,
 * so a row or rail that shows fewer links to all of them.
 */
export function buildHomeArtists(input: {
  artists: readonly PublicArtistSummary[];
  total: number | null;
  soloDetail: PublicArtistDetail | null;
  artBaseUrl: URL | null;
}): HomeArtistsVm | null {
  const shown = input.artists.slice(0, HOME_ARTISTS_MAX);
  const layout = homeArtistsLayout(shown.length);
  if (layout === null) return null;
  const cards = buildCatalogueArtistCards(shown);
  const total = Math.max(input.total ?? shown.length, shown.length);
  const first = shown[0];
  const firstCard = cards[0];
  return {
    layout,
    cards,
    viewAll:
      layout === "row" || layout === "rail"
        ? { label: total > shown.length ? `All ${total} artists` : "All artists", href: "/artists" }
        : null,
    laxArtHref: artUrl(input.artBaseUrl, "/artists"),
    solo:
      layout === "feature" && first && firstCard
        ? buildSolo(firstCard, first, input.soloDetail, input.artBaseUrl)
        : null,
  };
}
