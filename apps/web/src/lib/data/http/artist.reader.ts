import "server-only";

import type { ArtistProfile, ArtistReader } from "@/lib/data/contracts";
import {
  type PublicArtistBrowseParams,
  type SitemapArtist,
  emptyFacets,
  portraitForPublicArtist,
  publicArtistAliasesSchema,
  publicArtistBrowseResultSchema,
  registryArtistProfileSchema,
  registryPublicArtistRowSchema,
  sitemapArtistRowSchema,
} from "@/lib/data/http/artist.schema";
import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import {
  readDataEnvelope,
  readJsonBody,
  readListEnvelope,
  readNullableListEnvelope,
} from "@/lib/data/http/envelope";
import { getServerApiBase, getServerHc } from "@/lib/data/http/hc-server";
import { createMockArtistReader } from "@/lib/data/mock/artist";
import type { PublicArtistDirectoryResult } from "@auction/types";
import { cache } from "react";

export type { PublicArtistBrowseParams, SitemapArtist };

export { portraitForPublicArtist };

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
    const body = await readJsonBody(res);
    const parsed = readDataEnvelope(body, publicArtistBrowseResultSchema, "GET /artists/browse");
    if (!Array.isArray(parsed.rows)) {
      return { rows: [], total: 0, facets: emptyFacets() };
    }
    return parsed;
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
    const body = await readJsonBody(res);
    return readDataEnvelope(body, registryArtistProfileSchema, `GET /artists/${artistId}`);
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
    const body = await readJsonBody(res);
    return readDataEnvelope(
      body,
      publicArtistAliasesSchema,
      `GET /artists/${artistId}/aliases-public`,
    );
  } catch {
    return [];
  }
}

/** Sitemap-only helper: list public artists for the discovery sitemap.
 * Returns an empty array when artists are disabled or when the upstream
 * endpoint fails — sitemaps must still be generated even on partial outages.
 */
export async function fetchArtistsForSitemap(limit = 1000): Promise<SitemapArtist[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return [];
  try {
    const res = await catalogueFetch(
      `${getServerApiBase()}/artists/public?limit=${limit}&offset=0`,
      CATALOGUE_FETCH_POLICIES.artists,
    );
    if (!res.ok) return [];
    const body = await readJsonBody(res);
    const { rows } = readNullableListEnvelope(body, sitemapArtistRowSchema, "GET /artists/public");
    return rows;
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
        const body = await readJsonBody(res);
        const { rows } = readListEnvelope(
          body,
          registryPublicArtistRowSchema,
          "GET /artists/public",
        );
        return rows;
      } catch {
        return [];
      }
    },
    async getById(id: string) {
      const client = await getServerHc();
      const res = await client.artists[":id"].$get({ param: { id } });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const body = await readJsonBody(res);
      const row = readDataEnvelope(body, registryPublicArtistRowSchema, `GET /artists/${id}`);
      return row;
    },
  };
}

export const getServerArtistById = cache(async function getServerArtistById(
  id: string,
): Promise<ArtistProfile | null> {
  const reader = await getServerArtistReader();
  return reader.getById(id);
});

/** Canonical slug redirect helper for legacy `/artist/[slug]` URLs. */
export async function fetchArtistBySlug(
  slug: string,
): Promise<{ id: string; displayName: string } | null> {
  const res = await fetch(`${getServerApiBase()}/artists/by-slug/${encodeURIComponent(slug)}`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { id: string; displayName: string } };
  return body.data ?? null;
}
