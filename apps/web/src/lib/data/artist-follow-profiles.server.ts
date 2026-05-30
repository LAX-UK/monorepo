import "server-only";

import type { ArtistFollowCardVm } from "@/lib/data/artist-follow-card.vm";
import type { ArtistFollowRow } from "@/lib/data/dto/dashboard-dtos";
import { fetchRegistryArtistById, portraitForPublicArtist } from "@/lib/data/http/artist.server";
import type { ArtistProfile } from "@auction/types";
import { cache } from "react";

function fallbackArtistName(artistId: string): string {
  return artistId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function toCardVm(row: ArtistFollowRow, profile: ArtistProfile | null): ArtistFollowCardVm {
  return {
    watchlistId: row.watchlistId,
    artistId: row.artistId,
    displayName: profile?.displayName?.trim() || fallbackArtistName(row.artistId),
    portraitUrl: portraitForPublicArtist(profile?.portraitUrl ?? profile?.heroImageUrl),
    shortBio: profile?.shortBio?.trim() || null,
    nationality: profile?.nationality?.trim() || null,
    birthYear: profile?.birthYear ?? null,
    deathYear: profile?.deathYear ?? null,
    ...(profile?.kind ? { kind: profile.kind } : {}),
    followedAtMs: row.createdAt.getTime(),
  };
}

/** Batch-resolve followed artists to card view-models (request-cached per artist id). */
export async function resolveArtistFollowProfiles(
  rows: readonly ArtistFollowRow[],
): Promise<ArtistFollowCardVm[]> {
  if (rows.length === 0) return [];

  const settled = await Promise.allSettled(
    rows.map(async (row) => {
      const profile = await fetchRegistryArtistById(row.artistId);
      return toCardVm(row, profile);
    }),
  );

  return settled.flatMap((entry, index) => {
    if (entry.status === "fulfilled") return [entry.value];
    const row = rows[index];
    if (!row) return [];
    return [toCardVm(row, null)];
  });
}

export const cachedResolveArtistFollowProfiles = cache(resolveArtistFollowProfiles);
