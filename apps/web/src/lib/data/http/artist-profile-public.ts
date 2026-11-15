import "server-only";

import { registryArtistProfileSchema } from "@/lib/data/http/artist.schema";
import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { getServerApiBase } from "@/lib/data/http/server-api-base";

/* A public, session-free read (the lot page renders without the session, CO-7). */

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
