import {
  HEADER_SEARCH_ARTIST_LIMIT,
  HEADER_SEARCH_EDITION_LIMIT,
  buildHeaderSearchGroups,
  parseHeaderSearchQuery,
} from "@/lib/search/header-search.vm";
import { fetchPublicArtists, fetchPublicArtworks } from "@/lib/shop-api.server";
import { NextResponse } from "next/server";

/**
 * Live results for the header search. Each half may fail on its own; the other still answers.
 * Only when both fail does the route report an error, and the field then falls back to a full
 * search on Enter.
 */
export async function GET(request: Request) {
  const query = parseHeaderSearchQuery(new URL(request.url).searchParams.get("q"));
  if (!query) {
    return NextResponse.json({ groups: [] }, { status: 400 });
  }
  const [editions, artists] = await Promise.allSettled([
    fetchPublicArtworks({ q: query, limit: HEADER_SEARCH_EDITION_LIMIT * 2 }),
    fetchPublicArtists({ q: query, limit: HEADER_SEARCH_ARTIST_LIMIT }),
  ]);
  if (editions.status === "rejected" && artists.status === "rejected") {
    return NextResponse.json({ groups: [] }, { status: 502 });
  }
  const groups = buildHeaderSearchGroups({
    editions: editions.status === "fulfilled" ? editions.value.items : [],
    artists: artists.status === "fulfilled" ? artists.value.items : [],
  });
  return NextResponse.json(
    { groups },
    { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
