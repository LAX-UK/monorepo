import type {
  ICoverAnalysisReader,
  IMediaAssetReader,
  MediaAssetRecord,
} from "@auction/persistence/interfaces";
import type { GalleryImage, Sale, SaleCoverSlotAssets } from "@auction/types";
import {
  buildSaleCoverSlotAssets,
  collectCoverAnalysisHashes,
  collectCoverSlotKeys,
} from "../lib/sale-cover-assets.js";
import type { IObjectStorage } from "./interfaces/object-storage.js";

import type { IMediaAssetEnricher } from "./interfaces/media-asset-enricher.js";

export type { MediaAssetRecord };

/** Joins `media_asset` rows to catalogue image keys (SRP: metadata lookup only). */
export class MediaAssetEnricher implements IMediaAssetEnricher {
  constructor(
    private readonly mediaAssetReader: IMediaAssetReader,
    private readonly storage?: IObjectStorage,
    private readonly coverAnalysisReader?: ICoverAnalysisReader,
  ) {}

  private normalizeKey(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    const extracted = this.storage?.extractKey(trimmed);
    return extracted ?? trimmed.replace(/^\/+/, "");
  }

  async lookupByKeys(keys: readonly string[]): Promise<Map<string, MediaAssetRecord>> {
    const normalized = [...new Set(keys.map((key) => this.normalizeKey(key)).filter(Boolean))];
    if (normalized.length === 0) return new Map();
    return this.mediaAssetReader.lookupByKeys(normalized);
  }

  async buildGalleryImages(
    keys: readonly string[],
    resolvedUrls: readonly string[],
  ): Promise<GalleryImage[] | undefined> {
    const lookup = await this.lookupByKeys(keys);
    return this.buildGalleryImagesWithLookup(keys, resolvedUrls, lookup);
  }

  buildGalleryImagesWithLookup(
    keys: readonly string[],
    resolvedUrls: readonly string[],
    lookup: Map<string, MediaAssetRecord>,
  ): GalleryImage[] | undefined {
    if (lookup.size === 0) return undefined;

    const assets = resolvedUrls.map((src, index) => {
      const key = keys[index];
      const normalizedKey = key ? this.normalizeKey(key) : "";
      const meta = normalizedKey ? lookup.get(normalizedKey) : undefined;
      const image: GalleryImage = { src };
      if (meta) {
        image.width = meta.width;
        image.height = meta.height;
        image.blurDataURL = meta.blurDataURL;
      }
      return image;
    });

    return assets.length > 0 ? assets : undefined;
  }

  async buildCoverSlotAssets(
    sales: readonly Pick<Sale, "id" | "title" | "coverSlots" | "coverImages">[],
    resolve: (key: string) => string,
  ): Promise<Map<string, SaleCoverSlotAssets>> {
    const keys = sales.flatMap((sale) => collectCoverSlotKeys(sale));
    const hashes = sales.flatMap((sale) => collectCoverAnalysisHashes(sale));
    const [media, analyses] = await Promise.all([
      this.lookupByKeys(keys),
      this.coverAnalysisReader?.lookupByHashes(hashes) ?? Promise.resolve(new Map()),
    ]);
    const lookups = {
      media: (key: string) => media.get(this.normalizeKey(key)),
      analysis: (hash: string) => analyses.get(hash),
      resolve,
    };
    const out = new Map<string, SaleCoverSlotAssets>();
    for (const sale of sales) {
      const assets = buildSaleCoverSlotAssets(sale, lookups);
      if (assets) out.set(sale.id, assets);
    }
    return out;
  }
}
