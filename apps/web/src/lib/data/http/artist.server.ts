import "server-only";

import type { ArtistProfile, ArtistReader } from "@/lib/data/contracts";
import { getServerHc } from "@/lib/data/http/hc-server";
import { createMockArtistReader } from "@/lib/data/mock/artist";

/** Allowed in next.config `images.remotePatterns` — used when `user.image` is null */
const PORTRAIT_FALLBACKS = [
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=640&q=80",
] as const;

function portraitForPublicArtist(id: string, image: string | null | undefined): string {
  const trimmed = image?.trim();
  if (trimmed) return trimmed;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % PORTRAIT_FALLBACKS.length;
  return PORTRAIT_FALLBACKS[idx] ?? PORTRAIT_FALLBACKS[0];
}

function mapPublicUserToArtist(row: {
  id: string;
  name: string;
  image?: string | null;
}): ArtistProfile {
  return {
    id: row.id,
    name: row.name,
    tagline: "Consignor",
    bio: "",
    portraitUrl: portraitForPublicArtist(row.id, row.image),
    stats: [],
  };
}

/**
 * Composition root for artist reads (DIP).
 * Uses `/users/public/artists` when `NEXT_PUBLIC_ENABLE_ARTISTS` is not `"false"`.
 */
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
