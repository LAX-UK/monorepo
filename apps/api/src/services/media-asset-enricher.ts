import type { Database } from "@auction/db";
import { mediaAsset } from "@auction/db";
import type { GalleryImage } from "@auction/types";
import { inArray } from "drizzle-orm";
import { findPostgresError } from "../lib/pg-error.js";
import type { IObjectStorage } from "./interfaces/object-storage.js";

/** Postgres `undefined_table` (42P01): schema not yet migrated for this table. */
function isUndefinedTableError(error: unknown): boolean {
  return findPostgresError(error)?.code === "42P01";
}

export type MediaAssetRecord = {
  key: string;
  width: number;
  height: number;
  blurDataURL: string;
};

/** Joins `media_asset` rows to catalogue image keys (SRP: metadata lookup only). */
export class MediaAssetEnricher {
  constructor(
    private readonly db: Database,
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

    try {
      const rows = await this.db
        .select({
          key: mediaAsset.key,
          width: mediaAsset.width,
          height: mediaAsset.height,
          blurDataURL: mediaAsset.blurDataURL,
        })
        .from(mediaAsset)
        .where(inArray(mediaAsset.key, normalized));

      return new Map(rows.map((row) => [row.key, row]));
    } catch (error) {
      if (isUndefinedTableError(error)) return new Map();
      throw error;
    }
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

    return assets.some((asset) => asset.blurDataURL != null) ? assets : undefined;
  }
}
