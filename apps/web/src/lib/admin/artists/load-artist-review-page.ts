import "server-only";

import { getAdminArtistById } from "@/lib/data/http/admin.server";
import type { ArtistProfile } from "@auction/types";

export type ArtistReviewPageModel = {
  artistId: string;
  artist: ArtistProfile;
};

/** Data/composition boundary for `/admin/artists/[id]/review`. */
export async function loadAdminArtistReviewPage(
  artistId: string,
): Promise<ArtistReviewPageModel | null> {
  const artist = await getAdminArtistById(artistId);
  if (!artist) return null;
  return { artistId, artist };
}
