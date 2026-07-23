import "server-only";

import {
  getAdminArtistById,
  getAdminArtistDuplicateCandidates,
  getAdminArtistList,
} from "@/lib/data/http/admin.server";
import { cache } from "react";

/** Cached artist detail data shared by the layout and overview route. */
export const loadAdminArtistDetailContext = cache(async (artistId: string) => {
  const artist = await getAdminArtistById(artistId);
  if (!artist) return null;

  const [artistRows, duplicates] = await Promise.all([
    getAdminArtistList({ q: artist.displayName, limit: 50 })
      .then((result) => result.rows)
      .catch(() => []),
    getAdminArtistDuplicateCandidates(artistId).catch(() => []),
  ]);

  return {
    artist,
    lotCount: artistRows.find((row) => row.id === artistId)?.lotCount ?? 0,
    duplicates,
  };
});
