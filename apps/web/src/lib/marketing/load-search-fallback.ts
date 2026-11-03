import "server-only";

import { getServerLotCount, getServerLotReader } from "@/lib/catalog/catalog.server";
import { fetchPublicArtistBrowse } from "@/lib/data/http/artist.reader";
import {
  SEARCH_FALLBACK_ARTIST_LIMIT,
  SEARCH_FALLBACK_LOT_LIMIT,
} from "@/lib/marketing/search-fallback";
import type { Lot, PublicArtistDirectoryRow } from "@auction/types";

export type SearchFallback = {
  pastLots: Lot[];
  pastCount: number;
  artists: PublicArtistDirectoryRow[];
};

const NOTHING: SearchFallback = { pastLots: [], pastCount: 0, artists: [] };

/**
 * What a search that found nothing on sale can still show: sold lots and artists matching the
 * same text. The fallback is a courtesy, so a failed read leaves the plain empty state.
 */
export async function loadSearchFallback(q: string, categoryId?: string): Promise<SearchFallback> {
  const filters = { q, ...(categoryId ? { categoryId } : {}) };
  try {
    const reader = await getServerLotReader();
    const [pastLots, pastCount, artists] = await Promise.all([
      reader.list({
        ...filters,
        status: "ended",
        sort: "endedDesc",
        limit: SEARCH_FALLBACK_LOT_LIMIT,
        offset: 0,
      }),
      getServerLotCount({ ...filters, status: "ended" }),
      fetchPublicArtistBrowse({ q, limit: SEARCH_FALLBACK_ARTIST_LIMIT }),
    ]);
    return { pastLots, pastCount: pastCount ?? pastLots.length, artists: artists.rows };
  } catch (error) {
    console.error("[search] fallback load failed", error);
    return NOTHING;
  }
}
