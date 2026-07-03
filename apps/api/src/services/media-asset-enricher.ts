import type { IMediaAssetReader, MediaAssetRecord } from "@auction/persistence";
import type { GalleryImage } from "@auction/types";
import type { IObjectStorage } from "./interfaces/object-storage.js";

export type { MediaAssetRecord };

/** Joins `media_asset` rows to catalogue image keys (SRP: metadata lookup only). */
export class MediaAssetEnricher {
  constructor(
    private readonly mediaAssetReader: IMediaAssetReader,
    private readonly storage?: IObjectStorage,
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
}
