import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import type { ArtCataloguePort } from "@/lib/ports";

export type ArtArtistsPageVm = {
  /** Upper-case A–Z, or null for the full newest-first directory. */
  letter: string | null;
  cards: CatalogueArtistCardVm[];
  /** Curated `featured_artists` placement; only on the unfiltered first page. */
  featured: CatalogueArtistCardVm[];
  nextPageHref: string | null;
  failed: boolean;
};

/** A letter page lists up to this many artists by name; the API does not page name sorts. */
export const ARTISTS_LETTER_PAGE_LIMIT = 50;
const ARTISTS_PAGE_SIZE = 24;
const FEATURED_ARTISTS_LIMIT = 6;

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseArtistLetter(value: string | string[] | undefined): string | null {
  const letter = firstString(value)?.trim().toUpperCase();
  return letter && /^[A-Z]$/.test(letter) ? letter : null;
}

export async function composeArtistsPage(
  catalogue: Pick<ArtCataloguePort, "listArtists">,
  query: { cursor?: string | string[]; letter?: string | string[] },
): Promise<ArtArtistsPageVm> {
  const letter = parseArtistLetter(query.letter);
  const cursor = letter ? undefined : firstString(query.cursor);
  const showFeatured = !letter && !cursor;
  const [pageResult, featuredResult] = await Promise.allSettled([
    catalogue.listArtists(
      letter
        ? { limit: ARTISTS_LETTER_PAGE_LIMIT, letter, sort: "nameAsc" }
        : { limit: ARTISTS_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
    ),
    showFeatured
      ? catalogue.listArtists({ limit: FEATURED_ARTISTS_LIMIT, placement: "featured_artists" })
      : Promise.resolve({ items: [] }),
  ]);
  const featured =
    featuredResult.status === "fulfilled"
      ? buildCatalogueArtistCards(featuredResult.value.items)
      : [];
  if (pageResult.status === "rejected") {
    return { letter, cards: [], featured, nextPageHref: null, failed: true };
  }
  const page = pageResult.value;
  return {
    letter,
    cards: buildCatalogueArtistCards(page.items),
    featured,
    nextPageHref:
      !letter && page.nextCursor ? `/artists?cursor=${encodeURIComponent(page.nextCursor)}` : null,
    failed: false,
  };
}
