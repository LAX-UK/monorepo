import "server-only";

import type { ArtistProfile, ArtistReader } from "@/lib/data/contracts";
import { getServerApiBase, getServerHc } from "@/lib/data/http/hc-server";
import { createMockArtistReader } from "@/lib/data/mock/artist";
import { cache } from "react";

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
    const res = await fetch(`${getServerApiBase()}/artists/public?limit=${limit}&offset=0`, {
      next: { revalidate: 300 },
    });
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
      const res = await fetch(`${apiBase}/artists/public?limit=24&offset=0`, {
        next: { revalidate: 60 },
      });
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
