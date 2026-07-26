import "server-only";

import {
  getAdminArtistById,
  getAdminArtistDuplicateCandidates,
} from "@/lib/data/http/admin.server";
import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin.server";
import type { ArtistProfile } from "@auction/types";

export type ArtistDuplicatesPageModel = {
  artistId: string;
  displayName: string;
  dupes: AdminArtistDuplicateHit[];
};

/** Data/composition boundary for `/admin/artists/[id]/duplicates`. */
export async function loadAdminArtistDuplicatesPage(
  artistId: string,
): Promise<(ArtistDuplicatesPageModel & { artist: ArtistProfile }) | null> {
  const [artist, dupes] = await Promise.all([
    getAdminArtistById(artistId),
    getAdminArtistDuplicateCandidates(artistId).catch(() => []),
  ]);
  if (!artist) return null;

  return {
    artist,
    artistId,
    displayName: artist.displayName,
    dupes,
  };
}
