import type { Lot, WithdrawnLotView } from "@auction/types";

/**
 * The public projection of a withdrawn (cancelled) lot. Built by choosing fields, not by removing
 * them, so a field added to the lot later stays private until it is chosen to be shown.
 */
export function toWithdrawnLotView(lot: Lot): WithdrawnLotView {
  return {
    id: lot.id,
    saleId: lot.saleId,
    lotNumber: lot.lotNumber,
    title: lot.title,
    description: lot.description,
    medium: lot.medium,
    dimensions: lot.dimensions,
    images: lot.images,
    ...(lot.imageAssets ? { imageAssets: lot.imageAssets } : {}),
    artistId: lot.artistId ?? null,
    categoryId: lot.categoryId,
    ...(lot.categoryIds ? { categoryIds: lot.categoryIds } : {}),
    auctionType: lot.auctionType,
    status: "withdrawn",
  };
}
