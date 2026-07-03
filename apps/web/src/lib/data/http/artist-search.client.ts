import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { ArtistKind, ArtistStatus } from "@auction/types";

export type PublicArtistSearchHit = {
  id: string;
  displayName: string;
  slug: string;
  kind: ArtistKind;
  status: ArtistStatus;
  matchedAlias: string | null;
  matchType: "exact" | "alias" | "partial" | "fuzzy";
  score: number;
};

/** GET /artists/check-name */
export async function checkArtistNameAvailability(
  displayName: string,
  signal?: AbortSignal,
): Promise<{ available: boolean; suggestions: string[] } | null> {
  try {
    const qs = new URLSearchParams({ displayName });
    const res = await browserFetch(`${browserApiBase()}/artists/check-name?${qs}`, {
      ...(signal ? { signal } : {}),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { available: boolean; suggestions: string[] } };
    return body.data;
  } catch {
    return null;
  }
}

/** GET /artists/search */
export async function searchPublicArtists(
  query: string,
  limit = 20,
): Promise<{ ok: true; data: PublicArtistSearchHit[] } | { ok: false }> {
  try {
    const qs = new URLSearchParams({ q: query, limit: String(limit) });
    const res = await browserFetch(`${browserApiBase()}/artists/search?${qs}`);
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { data: PublicArtistSearchHit[] };
    return { ok: true, data: body.data };
  } catch {
    return { ok: false };
  }
}
