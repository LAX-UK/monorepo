import "server-only";

import type { ArtistProfile, ArtistReader } from "@/lib/data/contracts";
import { getServerHc } from "@/lib/data/http/hc-server";
import { createMockArtistReader } from "@/lib/data/mock/artist";
import { cache } from "react";

export function portraitForPublicArtist(image: string | null | undefined): string | null {
  const trimmed = image?.trim();
  return trimmed || null;
}

export function mapPublicUserToArtist(row: {
  id: string;
  name: string;
  image?: string | null;
}): ArtistProfile {
  return {
    id: row.id,
    name: row.name,
    tagline: "Consignor",
    bio: "",
    portraitUrl: portraitForPublicArtist(row.image),
    stats: [],
  };
}

/** Composition root for artist reads (DIP).
 * Uses `/users/public/artists` when `NEXT_PUBLIC_ENABLE_ARTISTS` is not `"false"`.
 */
/** Sitemap-only helper: list public artists for the discovery sitemap.
 * * Returns an empty array when artists are disabled or when the upstream
 * endpoint fails — sitemaps must still be generated even on partial outages.
 */
export type SitemapArtist = { id: string; name: string };

export async function fetchArtistsForSitemap(limit = 1000): Promise<SitemapArtist[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return [];
  try {
    const client = await getServerHc();
    const res = await client.users.public.artists.$get({
      query: { limit: String(limit), offset: "0" },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data: { id: string; name: string }[];
    };
    return body.data
      .map((row) => ({ id: row.id, name: row.name }))
      .filter((artist) => Boolean(artist.id && artist.name));
  } catch {
    return [];
  }
}

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

  const client = await getServerHc();
  return {
    async listFeatured() {
      const res = await client.users.public.artists.$get({ query: { limit: "24", offset: "0" } });
      if (!res.ok) return [];
      const body = (await res.json()) as {
        data: { id: string; name: string; image?: string | null }[];
      };
      return body.data.map(mapPublicUserToArtist);
    },
    async getById(id: string) {
      const res = await client.users.public[":userId"].$get({ param: { userId: id } });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as {
        data: { id: string; name: string; image?: string | null };
      };
      return mapPublicUserToArtist(body.data);
    },
  };
}

export const getServerArtistById = cache(async function getServerArtistById(
  id: string,
): Promise<ArtistProfile | null> {
  const reader = await getServerArtistReader();
  return reader.getById(id);
});
