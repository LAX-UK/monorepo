import { formatEditionCount } from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  isCatalogueArtworkSoldOut,
  toCatalogueArtworkCardVm,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { MarketingHeaderSearchResultGroup } from "@auction/marketing-ui";
import type { PublicArtistSummary, PublicArtworkSummary } from "@auction/shop-contracts";

/** Editions and artists shown while typing; the full list is one Enter away. */
export const HEADER_SEARCH_EDITION_LIMIT = 5;
export const HEADER_SEARCH_ARTIST_LIMIT = 3;
export const HEADER_SEARCH_MAX_QUERY = 80;

/** The query as the suggestions route accepts it, or null when it is too short or too long. */
export function parseHeaderSearchQuery(value: string | null): string | null {
  const query = value?.trim() ?? "";
  if (query.length < 2 || query.length > HEADER_SEARCH_MAX_QUERY) return null;
  return query;
}

/**
 * Header search results: editions first (available before sold out, each with its artist and
 * price), then artists with editions. Empty groups are left out.
 */
export function buildHeaderSearchGroups(input: {
  editions: readonly PublicArtworkSummary[];
  artists: readonly PublicArtistSummary[];
}): MarketingHeaderSearchResultGroup[] {
  const editions = [...input.editions]
    .sort((a, b) => Number(isCatalogueArtworkSoldOut(a)) - Number(isCatalogueArtworkSoldOut(b)))
    .slice(0, HEADER_SEARCH_EDITION_LIMIT)
    .map((item) => {
      const card = toCatalogueArtworkCardVm(item);
      return {
        id: item.slug,
        label: card.title,
        detail: card.priceLine ? `${card.artistName} · ${card.priceLine}` : card.artistName,
        href: card.href,
        imageUrl: card.imageUrl,
      };
    });
  const artists = input.artists
    .filter((artist) => artist.artworkCount > 0)
    .slice(0, HEADER_SEARCH_ARTIST_LIMIT)
    .map((artist) => ({
      id: artist.slug,
      label: artist.name,
      detail: formatEditionCount(artist.artworkCount) ?? undefined,
      href: `/artists/${artist.slug}`,
      imageUrl: artist.portraitUrl,
      imageShape: "circle" as const,
    }));
  return [
    ...(editions.length > 0 ? [{ id: "editions", title: "Editions", items: editions }] : []),
    ...(artists.length > 0 ? [{ id: "artists", title: "Artists", items: artists }] : []),
  ];
}
