import "server-only";

import { getAdminArtistById, getAdminLotList } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import type { ArtistProfile, CategoryNode } from "@auction/types";

type AdminLotListRow = Awaited<ReturnType<typeof getAdminLotList>>[number];

export type ArtistEditPageModel = {
  artistId: string;
  artist: ArtistProfile;
  lots: AdminLotListRow[];
  categories: CategoryNode[];
  notFound: boolean;
};

/** Data/composition boundary for `/admin/artists/[id]/edit`. */
export async function loadAdminArtistEditPage(artistId: string): Promise<ArtistEditPageModel> {
  const [artist, lots, categories] = await Promise.all([
    getAdminArtistById(artistId),
    getAdminLotList({ artistId, limit: 25 }).catch(() => []),
    (async () => {
      try {
        return await (await getServerCategoryReader()).tree();
      } catch {
        return [];
      }
    })(),
  ]);

  if (!artist) {
    return {
      artistId,
      artist: {} as ArtistProfile,
      lots: [],
      categories,
      notFound: true,
    };
  }

  return {
    artistId,
    artist,
    lots,
    categories,
    notFound: false,
  };
}
