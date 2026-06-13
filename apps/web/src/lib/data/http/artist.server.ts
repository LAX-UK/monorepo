import "server-only";

import type { ArtistProfile, ArtistReader } from "@/lib/data/contracts";
import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import { getServerApiBase, getServerHc } from "@/lib/data/http/hc-server";
import { createMockArtistReader } from "@/lib/data/mock/artist";
import type {
  PublicArtistDirectoryFacets,
  PublicArtistDirectoryResult,
  PublicArtistDirectoryRow,
} from "@auction/types";
import { cache } from "react";

/** Artist catalogue reads are public — always use tagged catalogueFetch (no auth gating). */

export type PublicArtistBrowseParams = {
  limit?: number;
  offset?: number;
  q?: string;
  letter?: string;
  kind?: string;
  kinds?: string;
  living?: boolean;
  historical?: boolean;
  nationality?: string;
  /** ISO 3166-1 alpha-2 origin country code. */
  country?: string;
  /** Collecting category (department) slug, e.g. `motor-cars`. */
  categorySlug?: string;
  featuredOnly?: boolean;
  featuredFirst?: boolean;
  /** Decade slug (e.g. `1900s`, `pre-1800`) — filters by `birth_year`. */
  decade?: string;
  /** When true, only artists with at least one `active`/`scheduled` lot. */
  hasUpcoming?: boolean;
  sort?: "name_asc" | "popular" | "recent";
};

function emptyFacets(): PublicArtistDirectoryFacets {
  return {
    total: 0,
    featured: 0,
    living: 0,
    historical: 0,
    byKind: {},
    hasUpcoming: 0,
    topNationalities: [],
    topCategories: [],
    topDecades: [],
    letters: [],
  };
}

/** Paginated public directory (`GET /artists/browse`) for marketing pages.
 * Returns `{ rows, total, facets }`; on failure returns an empty result with
 * an empty facet bag so pages never need to special-case nulls. */
export async function fetchPublicArtistBrowse(
  params: PublicArtistBrowseParams = {},
): Promise<PublicArtistDirectoryResult> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") {
    return { rows: [], total: 0, facets: emptyFacets() };
  }
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit ?? 24));
  sp.set("offset", String(params.offset ?? 0));
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.letter?.trim()) sp.set("letter", params.letter.trim());
  if (params.kind?.trim()) sp.set("kind", params.kind.trim());
  if (params.kinds?.trim()) sp.set("kinds", params.kinds.trim());
  if (params.living === true) sp.set("living", "true");
  if (params.historical === true) sp.set("historical", "true");
  if (params.nationality?.trim()) sp.set("nationality", params.nationality.trim());
  if (params.country?.trim()) sp.set("country", params.country.trim());
  if (params.categorySlug?.trim()) sp.set("categorySlug", params.categorySlug.trim());
  if (params.featuredOnly === true) sp.set("featuredOnly", "true");
  if (params.featuredFirst === true) sp.set("featuredFirst", "true");
  if (params.decade?.trim()) sp.set("decade", params.decade.trim());
  if (params.hasUpcoming === true) sp.set("hasUpcoming", "true");
  if (params.sort) sp.set("sort", params.sort);
  try {
    const res = await catalogueFetch(
      `${getServerApiBase()}/artists/browse?${sp.toString()}`,
      CATALOGUE_FETCH_POLICIES.artists,
    );
    if (!res.ok) {
      return { rows: [], total: 0, facets: emptyFacets() };
    }
    const body = (await res.json()) as {
      data?: {
        rows?: PublicArtistDirectoryRow[];
        total?: number;
        facets?: PublicArtistDirectoryFacets;
      };
    };
    if (!body.data || !Array.isArray(body.data.rows)) {
      return { rows: [], total: 0, facets: emptyFacets() };
    }
    return {
      rows: body.data.rows,
      total: body.data.total ?? 0,
      facets: body.data.facets ?? emptyFacets(),
    };
  } catch {
    return { rows: [], total: 0, facets: emptyFacets() };
  }
}

/** Full registry artist (richer shape than the marketing `ArtistProfile`).
 * Used by the public profile page so it can render the registry kind, dates,
 * and merged status correctly. Returns `null` for any non-OK response so
 * callers can fall through to the seller-fallback codepath. */
export async function fetchRegistryArtistById(
  artistId: string,
): Promise<import("@auction/types").ArtistProfile | null> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return null;
  try {
    const res = await catalogueFetch(
      `${getServerApiBase()}/artists/${encodeURIComponent(artistId)}`,
      CATALOGUE_FETCH_POLICIES.artists,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data: import("@auction/types").ArtistProfile };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** Public alias chips for the artist hero (`GET /artists/:id/aliases-public`). */
export async function fetchPublicArtistAliases(artistId: string): Promise<string[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return [];
  try {
    const res = await catalogueFetch(
      `${getServerApiBase()}/artists/${encodeURIComponent(artistId)}/aliases-public`,
      CATALOGUE_FETCH_POLICIES.artists,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { data: string[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

export function portraitForPublicArtist(image: string | null | undefined): string | null {
  const trimmed = image?.trim();
  return trimmed || null;
}

/** Adapt a row from the canonical `/artists/public` endpoint to the lighter
 * `ArtistProfile` shape consumed by marketing pages. The detail page reads
 * from `/artists/by-slug` / `/artists/:id` and uses the richer
 * `@auction/types` `ArtistProfile`. */
function mapRegistryRowToArtist(row: {
  id: string;
  displayName: string;
  shortBio?: string | null;
  portraitUrl?: string | null;
  nationality?: string | null;
}): ArtistProfile {
  return {
    id: row.id,
    name: row.displayName,
    tagline: row.nationality?.trim() || "Catalogue artist",
    bio: row.shortBio ?? "",
    portraitUrl: portraitForPublicArtist(row.portraitUrl ?? null),
    stats: [],
  };
}

/** Sitemap-only helper: list public artists for the discovery sitemap.
 * Returns an empty array when artists are disabled or when the upstream
 * endpoint fails — sitemaps must still be generated even on partial outages.
 */
export type SitemapArtist = { id: string; name: string };

export async function fetchArtistsForSitemap(limit = 1000): Promise<SitemapArtist[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return [];
  try {
    const res = await catalogueFetch(
      `${getServerApiBase()}/artists/public?limit=${limit}&offset=0`,
      CATALOGUE_FETCH_POLICIES.artists,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data: { id: string; displayName: string }[];
    };
    return body.data
      .map((row) => ({ id: row.id, name: row.displayName }))
      .filter((artist) => Boolean(artist.id && artist.name));
  } catch {
    return [];
  }
}

/** Composition root for artist reads (DIP). Reads the canonical artist
 * registry (`/artists/public` and `/artists/:id`) instead of the legacy
 * `/users/public/artists` shape, so curated artists/makers/brands are the
 * authoritative source for the public surfaces. */
export async function getServerArtistReader(): Promise<ArtistReader> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") {
    return {
      async listFeatured() {
        return [];
      },
      async getById() {
        return null;
      },
    };
  }

  if (process.env.NEXT_PUBLIC_USE_MOCK_ARTISTS === "true") {
    return createMockArtistReader();
  }

  const apiBase = getServerApiBase();
  return {
    async listFeatured() {
      try {
        const res = await catalogueFetch(
          `${apiBase}/artists/public?limit=24&offset=0`,
          CATALOGUE_FETCH_POLICIES.artists,
        );
        if (!res.ok) return [];
        const body = (await res.json()) as {
          data: {
            id: string;
            displayName: string;
            shortBio?: string | null;
            portraitUrl?: string | null;
            nationality?: string | null;
          }[];
        };
        return body.data.map(mapRegistryRowToArtist);
      } catch {
        return [];
      }
    },
    async getById(id: string) {
      // Artist detail is served by the registry endpoint that already filters
      // out non-approved rows for non-privileged callers.
      const client = await getServerHc();
      const res = await client.artists[":id"].$get({ param: { id } });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as {
        data: {
          id: string;
          displayName: string;
          shortBio?: string | null;
          portraitUrl?: string | null;
          nationality?: string | null;
        };
      };
      return mapRegistryRowToArtist(body.data);
    },
  };
}

export const getServerArtistById = cache(async function getServerArtistById(
  id: string,
): Promise<ArtistProfile | null> {
  const reader = await getServerArtistReader();
  return reader.getById(id);
});
