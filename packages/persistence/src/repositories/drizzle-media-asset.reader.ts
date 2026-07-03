import type { Database } from "@auction/db";
import { mediaAsset } from "@auction/db";
import { inArray } from "drizzle-orm";
import type { IMediaAssetReader, MediaAssetRecord } from "../interfaces/media-asset.reader.js";

function isUndefinedTableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === "42P01") return true;
  const cause = (error as { cause?: unknown }).cause;
  if (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { code?: unknown }).code === "42P01"
  ) {
    return true;
  }
  return false;
}

export class DrizzleMediaAssetReader implements IMediaAssetReader {
  constructor(private readonly db: Database) {}

  async lookupByKeys(keys: readonly string[]): Promise<Map<string, MediaAssetRecord>> {
    const normalized = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
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
}
