import type {
  GalleryImage,
  ItemSubmission,
  Lot,
  Sale,
  SaleDayMedia,
  SaleDayMediaRef,
  SaleDayPhoto,
} from "@auction/types";
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

function collectSaleDayImageKeys(sales: readonly Sale[]): string[] {
  return collectUniqueKeys(
    sales.flatMap((row) =>
      (row.dayImages ?? []).flatMap((r) => {
        const keys = [r.key];
        if (r.mediaType === "video" && "posterKey" in r && r.posterKey) keys.push(r.posterKey);
        return keys;
      }),
    ),
  );
}

/**
 * Resolve day-media refs into enriched SaleDayMedia[].
 * Videos get src + optional posterSrc only (no image enrichment).
 * Images get enriched GalleryImage merged with caption/alt.
 */
function mergeDayMediaAssets(
  refs: SaleDayMediaRef[],
  resolvedMap: Map<string, string>,
  enrichedImages: (GalleryImage | undefined)[],
): SaleDayMedia[] {
  return refs.map((ref, i) => {
    if (ref.mediaType === "video") {
      const src = resolvedMap.get(ref.key.trim()) ?? ref.key;
      const posterSrc =
        "posterKey" in ref && ref.posterKey
          ? (resolvedMap.get(ref.posterKey.trim()) ?? ref.posterKey)
          : undefined;
      const video: import("@auction/types").SaleDayVideo = {
        mediaType: "video",
        src,
        ...(posterSrc ? { posterSrc } : {}),
        ...(ref.caption ? { caption: ref.caption } : {}),
      };
      return video;
    }
    const asset = enrichedImages[i] ?? { src: resolvedMap.get(ref.key.trim()) ?? ref.key };
    const photo: SaleDayPhoto = {
      ...asset,
      mediaType: "image",
      ...(ref.caption ? { caption: ref.caption } : {}),
      ...(!asset.alt && ref.alt ? { alt: ref.alt } : {}),
    };
    return photo;
  });
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
  const coverKeys = row.coverImages;
  const dayRefs = row.dayImages ?? [];
  const dayKeys = dayRefs.map((r) => r.key);
  const allKeys = collectUniqueKeys([...coverKeys, ...dayKeys]);

  const resolvedMap = await resolveKeysBatch(resolver, allKeys);
  const coverImages = applyResolvedKeys(coverKeys, resolvedMap);
  const coverImageAssets = await enrichImageAssets(enricher, coverKeys, coverImages);

  let dayImageAssets: SaleDayMedia[] | undefined;
  if (dayRefs.length > 0) {
    const imageRefs = dayRefs.filter((r) => r.mediaType !== "video");
    const imageKeys = imageRefs.map((r) => r.key);
    const rawImageAssets =
      imageKeys.length > 0
        ? await enrichImageAssets(enricher, imageKeys, applyResolvedKeys(imageKeys, resolvedMap))
        : undefined;
    // Build a per-ref enriched image array aligned with dayRefs (videos get undefined)
    let enrichedIdx = 0;
    const enrichedImages = dayRefs.map((r) =>
      r.mediaType === "video" ? undefined : (rawImageAssets?.[enrichedIdx++] ?? undefined),
    );
    dayImageAssets = mergeDayMediaAssets(dayRefs, resolvedMap, enrichedImages);
  }

  return {
    ...row,
    ...(resolver ? { coverImages } : {}),
    ...(coverImageAssets ? { coverImageAssets } : {}),
    ...(dayImageAssets ? { dayImageAssets } : {}),
  };
}

/** Admin edit: keep raw storage keys and expose resolved URLs for thumbnails. */
export type SaleAdminImages = Sale & {
  coverImagePresentedUrls: string[];
  /** Resolved preview URLs for each day-photo ref, aligned with `Sale.dayImages`. */
  dayImagePresentedUrls: string[];
};

export async function presentSaleAdminImages(
  resolver: MediaUrlResolver | undefined,
  row: Sale,
  enricher?: MediaAssetEnricher,
): Promise<SaleAdminImages> {
  const coverKeys = row.coverImages;
  const dayRefs = row.dayImages ?? [];
  const dayKeys = dayRefs.map((r) => r.key);
  const allKeys = collectUniqueKeys([...coverKeys, ...dayKeys]);

  const resolvedMap = await resolveKeysBatch(resolver, allKeys);

  const coverImagePresentedUrls = resolver
    ? applyResolvedKeys(coverKeys, resolvedMap)
    : coverKeys.map((k) => k);

  const dayImagePresentedUrls = resolver
    ? applyResolvedKeys(dayKeys, resolvedMap)
    : dayKeys.map((k) => k);

  const coverImageAssets = await enrichImageAssets(enricher, coverKeys, coverImagePresentedUrls);

  let dayImageAssets: SaleDayMedia[] | undefined;
  if (dayRefs.length > 0) {
    const imageRefs = dayRefs.filter((r) => r.mediaType !== "video");
    const imageKeys = imageRefs.map((r) => r.key);
    const rawImageAssets =
      imageKeys.length > 0
        ? await enrichImageAssets(enricher, imageKeys, applyResolvedKeys(imageKeys, resolvedMap))
        : undefined;
    let enrichedIdx = 0;
    const enrichedImages = dayRefs.map((r) =>
      r.mediaType === "video" ? undefined : (rawImageAssets?.[enrichedIdx++] ?? undefined),
    );
    dayImageAssets = mergeDayMediaAssets(dayRefs, resolvedMap, enrichedImages);
  }

  return {
    ...row,
    coverImages: coverKeys,
    coverImagePresentedUrls,
    dayImagePresentedUrls,
    ...(coverImageAssets ? { coverImageAssets } : {}),
    ...(dayImageAssets ? { dayImageAssets } : {}),
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
  const saleDayKeys = collectSaleDayImageKeys(rows.map((r) => r.sale));
  const lotKeys = collectLotImageKeys(rows.flatMap((r) => r.lots));
  const allKeys = collectUniqueKeys([...saleKeys, ...saleDayKeys, ...lotKeys]);

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

      const dayRefs = sale.dayImages ?? [];
      let dayImageAssets: SaleDayMedia[] | undefined;
      if (dayRefs.length > 0) {
        const imageRefs = dayRefs.filter((r) => r.mediaType !== "video");
        const imageKeys = imageRefs.map((r) => r.key);
        const rawDayAssets =
          imageKeys.length > 0
            ? enricher && assetLookup.size > 0
              ? await buildGalleryFromBatch(
                  enricher,
                  imageKeys,
                  applyResolvedKeys(imageKeys, resolvedMap),
                  assetLookup,
                )
              : await enrichImageAssets(
                  enricher,
                  imageKeys,
                  applyResolvedKeys(imageKeys, resolvedMap),
                )
            : undefined;
        let enrichedIdx = 0;
        const enrichedImages = dayRefs.map((r) =>
          r.mediaType === "video" ? undefined : (rawDayAssets?.[enrichedIdx++] ?? undefined),
        );
        dayImageAssets = mergeDayMediaAssets(dayRefs, resolvedMap, enrichedImages);
      }

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
        sale: {
          ...sale,
          coverImages,
          ...(coverImageAssets ? { coverImageAssets } : {}),
          ...(dayImageAssets ? { dayImageAssets } : {}),
        },
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
