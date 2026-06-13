import type { ItemSubmission, Lot, Sale } from "@auction/types";
import type { MediaAssetEnricher } from "../services/media-asset-enricher.js";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";

async function enrichImageAssets(
  enricher: MediaAssetEnricher | undefined,
  keys: readonly string[],
  resolved: readonly string[],
) {
  if (!enricher) return undefined;
  return enricher.buildGalleryImages(keys, resolved);
}

export async function presentLotImages(
  resolver: MediaUrlResolver | undefined,
  row: Lot,
  enricher?: MediaAssetEnricher,
): Promise<Lot> {
  const keys = row.images;
  if (!resolver) {
    const imageAssets = await enrichImageAssets(enricher, keys, keys);
    return imageAssets ? { ...row, imageAssets } : row;
  }
  const images = await resolver.resolveMany(keys);
  const imageAssets = await enrichImageAssets(enricher, keys, images);
  return imageAssets ? { ...row, images, imageAssets } : { ...row, images };
}

export async function presentLotsImages(
  resolver: MediaUrlResolver | undefined,
  rows: Lot[],
  enricher?: MediaAssetEnricher,
): Promise<Lot[]> {
  return Promise.all(rows.map((row) => presentLotImages(resolver, row, enricher)));
}

export async function presentSaleImages(
  resolver: MediaUrlResolver | undefined,
  row: Sale,
  enricher?: MediaAssetEnricher,
): Promise<Sale> {
  const keys = row.coverImages;
  if (!resolver) {
    const coverImageAssets = await enrichImageAssets(enricher, keys, keys);
    return coverImageAssets ? { ...row, coverImageAssets } : row;
  }
  const coverImages = await resolver.resolveMany(keys);
  const coverImageAssets = await enrichImageAssets(enricher, keys, coverImages);
  return coverImageAssets ? { ...row, coverImages, coverImageAssets } : { ...row, coverImages };
}

/** Admin edit: keep raw storage keys and expose resolved URLs for thumbnails. */
export type SaleAdminImages = Sale & {
  coverImagePresentedUrls: string[];
};

export async function presentSaleAdminImages(
  resolver: MediaUrlResolver | undefined,
  row: Sale,
  enricher?: MediaAssetEnricher,
): Promise<SaleAdminImages> {
  const keys = row.coverImages;
  const coverImagePresentedUrls = resolver ? await resolver.resolveMany(keys) : keys.map((k) => k);
  const coverImageAssets = await enrichImageAssets(enricher, keys, coverImagePresentedUrls);
  return {
    ...row,
    coverImages: keys,
    coverImagePresentedUrls,
    ...(coverImageAssets ? { coverImageAssets } : {}),
  };
}

/** Admin edit: keep raw storage keys and expose resolved URLs for thumbnails. */
export type LotAdminImages = Lot & {
  imagePresentedUrls: string[];
};

export async function presentLotAdminImages(
  resolver: MediaUrlResolver | undefined,
  row: Lot,
  enricher?: MediaAssetEnricher,
): Promise<LotAdminImages> {
  const keys = row.images;
  const imagePresentedUrls = resolver ? await resolver.resolveMany(keys) : keys.map((k) => k);
  const imageAssets = await enrichImageAssets(enricher, keys, imagePresentedUrls);
  return {
    ...row,
    images: keys,
    imagePresentedUrls,
    ...(imageAssets ? { imageAssets } : {}),
  };
}

export async function presentSalesWithLotsImages(
  resolver: MediaUrlResolver | undefined,
  rows: { sale: Sale; lots: Lot[] }[],
  enricher?: MediaAssetEnricher,
): Promise<{ sale: Sale; lots: Lot[] }[]> {
  if (!resolver && !enricher) return rows;
  return Promise.all(
    rows.map(async (row) => ({
      sale: await presentSaleImages(resolver, row.sale, enricher),
      lots: await presentLotsImages(resolver, row.lots, enricher),
    })),
  );
}

export async function presentSubmissionImages(
  resolver: MediaUrlResolver | undefined,
  row: ItemSubmission,
  enricher?: MediaAssetEnricher,
): Promise<ItemSubmission> {
  const keys = row.images;
  if (!resolver) {
    const imageAssets = await enrichImageAssets(enricher, keys, keys);
    return imageAssets ? { ...row, imageAssets } : row;
  }
  const images = await resolver.resolveMany(keys);
  const imageAssets = await enrichImageAssets(enricher, keys, images);
  return imageAssets ? { ...row, images, imageAssets } : { ...row, images };
}

export async function presentSubmissionsImages(
  resolver: MediaUrlResolver | undefined,
  rows: ItemSubmission[],
  enricher?: MediaAssetEnricher,
): Promise<ItemSubmission[]> {
  return Promise.all(rows.map((row) => presentSubmissionImages(resolver, row, enricher)));
}
