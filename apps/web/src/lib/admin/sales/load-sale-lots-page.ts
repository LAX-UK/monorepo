import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { getAdminArtistById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import type { CategoryNode, Lot, Sale } from "@auction/types";

export type SaleLotsPageModel = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  canAddLots: boolean;
  categories: CategoryNode[];
  /** Each lot's artist by ID, for the artist column; an artist that cannot be read is left out. */
  artistNameById: Record<string, string>;
};

/** The names of the artists behind these lots, looked up once each. */
async function artistNames(lots: readonly Lot[]): Promise<Record<string, string>> {
  const ids = [
    ...new Set(lots.map((lot) => lot.artistId).filter((id): id is string => Boolean(id?.trim()))),
  ];
  const entries = await Promise.all(
    ids.map(async (id) => {
      const artist = await getAdminArtistById(id).catch(() => null);
      return artist?.displayName ? ([id, artist.displayName] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/** Data/composition boundary for `/admin/sales/[id]/lots`. */
export async function loadAdminSaleLotsPage(saleId: string): Promise<SaleLotsPageModel> {
  const bundle = await loadAdminSaleDetail(saleId);
  const { sale, lots } = bundle;
  const canAddLots =
    sale.status === "draft" || sale.status === "scheduled" || sale.status === "active";
  const [categories, artistNameById] = await Promise.all([
    canAddLots && sale.status !== "draft"
      ? (await getServerCategoryReader()).tree().catch(() => [])
      : Promise.resolve([]),
    artistNames(lots),
  ]);

  return {
    saleId,
    sale,
    lots,
    canAddLots,
    categories,
    artistNameById,
  };
}
