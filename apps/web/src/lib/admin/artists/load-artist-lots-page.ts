import "server-only";

import { getAdminLotList } from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";

export type ArtistLotsPageModel = {
  artistId: string;
  lots: Lot[];
};

/** Data/composition boundary for `/admin/artists/[id]/lots`. */
export async function loadAdminArtistLotsPage(artistId: string): Promise<ArtistLotsPageModel> {
  const lots = await getAdminLotList({ artistId, limit: 50 }).catch(() => []);
  return { artistId, lots };
}
