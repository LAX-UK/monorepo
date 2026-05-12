import "server-only";
import { getServerArtistById } from "@/lib/data/http/artist.server";
import { cache } from "react";

/** Resolve a batch of artist IDs to a display-name map.
 *
 * Returns a record keyed by `artistId` whose value is the canonical display
 * name from the artist registry. Missing or failed lookups are simply omitted
 * from the result so callers can fall back to a placeholder.
 *
 * Reads are wrapped in `react/cache` upstream, so the per-id round trip is
 * memoized within the current request.
 */
export async function resolveArtistNames(
  artistIds: readonly (string | null | undefined)[],
): Promise<Record<string, string>> {
  const unique = Array.from(
    new Set(artistIds.filter((id): id is string => typeof id === "string" && id.length > 0)),
  );
  if (unique.length === 0) return {};
  const entries = await Promise.allSettled(
    unique.map(async (id) => {
      const profile = await getServerArtistById(id);
      return profile ? ([id, profile.name] as const) : null;
    }),
  );
  const result: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.status === "fulfilled" && entry.value) {
      result[entry.value[0]] = entry.value[1];
    }
  }
  return result;
}

export const cachedResolveArtistNames = cache(resolveArtistNames);
