import type { GalleryImage, ItemSubmission, Lot, Sale } from "@auction/types";
import type { MediaAssetEnricher, MediaAssetRecord } from "../services/media-asset-enricher.js";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";

function collectUniqueKeys(keys: readonly string[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    const trimmed = key.trim();
    if (trimmed) out.add(trimmed);
  }
  return [...out];
}

function collectLotImageKeys(lots: readonly Lot[]): string[] {
  return collectUniqueKeys(lots.flatMap((row) => row.images));
}

function collectSaleCoverKeys(sales: readonly Sale[]): string[] {
  return collectUniqueKeys(sales.flatMap((row) => row.coverImages));
}

async function enrichImageAssets(
  enricher: MediaAssetEnricher | undefined,
  keys: readonly string[],
  resolved: readonly string[],
) {
  if (!enricher) return undefined;
  return enricher.buildGalleryImages(keys, resolved);
}

async function buildGalleryFromBatch(
  enricher: MediaAssetEnricher | undefined,
  keys: readonly string[],
  resolvedUrls: readonly string[],
  assetLookup: Map<string, MediaAssetRecord>,
): Promise<GalleryImage[] | undefined> {
  if (!enricher || assetLookup.size === 0) return undefined;
  return enricher.buildGalleryImagesWithLookup(keys, resolvedUrls, assetLookup);
}

async function resolveKeysBatch(
  resolver: MediaUrlResolver | undefined,
  keys: readonly string[],
): Promise<Map<string, string>> {
  if (!keys.length) return new Map();
  if (!resolver) {
    return new Map(keys.map((key) => [key, key]));
  }
  return resolver.resolveManyUnique(keys);
}

function applyResolvedKeys(keys: readonly string[], resolved: Map<string, string>): string[] {
  return keys.map((key) => resolved.get(key.trim()) ?? key);
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
  const resolvedMap = await resolveKeysBatch(resolver, keys);
  const images = applyResolvedKeys(keys, resolvedMap);
  const imageAssets = await enrichImageAssets(enricher, keys, images);
  return imageAssets ? { ...row, images, imageAssets } : { ...row, images };
}

export async function presentLotsImages(
  resolver: MediaUrlResolver | undefined,
  rows: Lot[],
  enricher?: MediaAssetEnricher,
): Promise<Lot[]> {
  if (rows.length === 0) return [];
  const allKeys = collectLotImageKeys(rows);
  const [resolvedMap, assetLookup] = await Promise.all([
    resolveKeysBatch(resolver, allKeys),
    enricher ? enricher.lookupByKeys(allKeys) : Promise.resolve(new Map()),
  ]);

  return Promise.all(
    rows.map(async (row) => {
      const keys = row.images;
      if (!resolver && !enricher) return row;
      const images = resolver ? applyResolvedKeys(keys, resolvedMap) : keys;
      const imageAssets =
        enricher && assetLookup.size > 0
          ? await buildGalleryFromBatch(enricher, keys, images, assetLookup)
          : await enrichImageAssets(enricher, keys, images);
      return imageAssets ? { ...row, images, imageAssets } : { ...row, images };
    }),
  );
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
  const resolvedMap = await resolveKeysBatch(resolver, keys);
  const coverImages = applyResolvedKeys(keys, resolvedMap);
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
  const resolvedMap = await resolveKeysBatch(resolver, keys);
  const coverImagePresentedUrls = resolver
    ? applyResolvedKeys(keys, resolvedMap)
    : keys.map((k) => k);
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
  const resolvedMap = await resolveKeysBatch(resolver, keys);
  const imagePresentedUrls = resolver ? applyResolvedKeys(keys, resolvedMap) : keys.map((k) => k);
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
  if (rows.length === 0) return [];

  const saleKeys = collectSaleCoverKeys(rows.map((r) => r.sale));
  const lotKeys = collectLotImageKeys(rows.flatMap((r) => r.lots));
  const allKeys = collectUniqueKeys([...saleKeys, ...lotKeys]);

  const [resolvedMap, assetLookup] = await Promise.all([
    resolveKeysBatch(resolver, allKeys),
    enricher ? enricher.lookupByKeys(allKeys) : Promise.resolve(new Map()),
  ]);

  return Promise.all(
    rows.map(async ({ sale, lots }) => {
      const coverKeys = sale.coverImages;
      const coverImages = resolver ? applyResolvedKeys(coverKeys, resolvedMap) : coverKeys;
      const coverImageAssets =
        enricher && assetLookup.size > 0
          ? await buildGalleryFromBatch(enricher, coverKeys, coverImages, assetLookup)
          : await enrichImageAssets(enricher, coverKeys, coverImages);

      const presentedLots = await Promise.all(
        lots.map(async (lotRow) => {
          const keys = lotRow.images;
          const images = resolver ? applyResolvedKeys(keys, resolvedMap) : keys;
          const imageAssets =
            enricher && assetLookup.size > 0
              ? await buildGalleryFromBatch(enricher, keys, images, assetLookup)
              : await enrichImageAssets(enricher, keys, images);
          return imageAssets ? { ...lotRow, images, imageAssets } : { ...lotRow, images };
        }),
      );

      return {
        sale: coverImageAssets
          ? { ...sale, coverImages, coverImageAssets }
          : { ...sale, coverImages },
        lots: presentedLots,
      };
    }),
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
  const resolvedMap = await resolveKeysBatch(resolver, keys);
  const images = applyResolvedKeys(keys, resolvedMap);
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
