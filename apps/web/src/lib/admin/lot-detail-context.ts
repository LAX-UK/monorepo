import "server-only";

import {
  getAdminArtistById,
  getAdminCategoryById,
  getAdminLegalEntityById,
  getAdminSaleById,
} from "@/lib/data/http/admin.server";
import type { Lot } from "@auction/types";

export type LotDetailContext = {
  sale: { id: string; title: string } | null;
  artist: { id: string; displayName: string } | null;
  seller: { id: string; displayName: string } | null;
  categories: { id: string; name: string }[];
};

export async function fetchLotDetailContext(auction: Lot): Promise<LotDetailContext> {
  const categoryIds =
    auction.categoryIds && auction.categoryIds.length > 0
      ? auction.categoryIds
      : auction.categoryId
        ? [auction.categoryId]
        : [];

  const [saleBundle, artist, seller, categoryResults] = await Promise.all([
    auction.saleId ? getAdminSaleById(auction.saleId).catch(() => null) : Promise.resolve(null),
    auction.artistId
      ? getAdminArtistById(auction.artistId).catch(() => null)
      : Promise.resolve(null),
    auction.sellerLegalEntityId
      ? getAdminLegalEntityById(auction.sellerLegalEntityId).catch(() => null)
      : Promise.resolve(null),
    Promise.all(categoryIds.map((cid) => getAdminCategoryById(cid).catch(() => null))),
  ]);

  return {
    sale: saleBundle ? { id: saleBundle.sale.id, title: saleBundle.sale.title } : null,
    artist: artist ? { id: artist.id, displayName: artist.displayName } : null,
    seller: seller ? { id: seller.id, displayName: seller.displayName } : null,
    categories: categoryResults
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map((c) => ({ id: c.id, name: c.name })),
  };
}

export { clampCatalogDescription as lotDetailHeaderDescription } from "@/lib/admin/catalog-detail-description";
