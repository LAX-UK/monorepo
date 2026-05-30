import "server-only";

import { fetchPublicArtistBrowse } from "@/lib/data/http/artist.server";
import type { PublicArtistDirectoryRow, ArtistProfile as RegistryArtist } from "@auction/types";

const MIN_RELATED = 4;
const MAX_RELATED = 8;

function takeRelated(rows: readonly PublicArtistDirectoryRow[], currentId: string) {
  return rows.filter((row) => row.id !== currentId).slice(0, MAX_RELATED);
}

function mergeRelated(
  current: PublicArtistDirectoryRow[],
  extra: readonly PublicArtistDirectoryRow[],
  currentId: string,
): PublicArtistDirectoryRow[] {
  const seen = new Set<string>([currentId, ...current.map((row) => row.id)]);
  const merged = [...current];
  for (const row of extra) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
    if (merged.length >= MAX_RELATED) break;
  }
  return merged;
}

/** Related directory artists for the profile "More in the directory" rail. */
export async function loadRelatedDirectoryArtists(
  currentId: string,
  registry: RegistryArtist | null,
): Promise<PublicArtistDirectoryRow[]> {
  const baseParams = {
    limit: 12,
    offset: 0,
    featuredFirst: true as const,
    sort: "popular" as const,
  };

  let rows = takeRelated(
    (
      await fetchPublicArtistBrowse({
        ...baseParams,
        ...(registry?.kind ? { kind: registry.kind } : {}),
      })
    ).rows,
    currentId,
  );

  if (rows.length < MIN_RELATED) {
    rows = mergeRelated(
      rows,
      takeRelated((await fetchPublicArtistBrowse(baseParams)).rows, currentId),
      currentId,
    );
  }

  const nationality = registry?.nationality?.trim();
  if (rows.length < MIN_RELATED && nationality) {
    rows = mergeRelated(
      rows,
      takeRelated(
        (
          await fetchPublicArtistBrowse({
            ...baseParams,
            nationality,
          })
        ).rows,
        currentId,
      ),
      currentId,
    );
  }

  return rows;
}
