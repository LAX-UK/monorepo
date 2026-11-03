import type { createDb } from "@auction/db";
import { mediaAsset } from "@auction/db";
import { inArray } from "drizzle-orm";

type Db = ReturnType<typeof createDb>;

export type MediaAssetSize = { key: string; width: number; height: number };

/** The size lookup as a query, so its SQL can be inspected without a connection. */
export function mediaAssetSizeQuery(db: Db, keys: readonly string[]) {
  return db
    .select({ key: mediaAsset.key, width: mediaAsset.width, height: mediaAsset.height })
    .from(mediaAsset)
    .where(inArray(mediaAsset.key, [...keys]));
}

/** Stored width and height by key, for the keys that have been measured. */
export async function loadMediaAssetSizes(
  db: Db,
  keys: readonly string[],
): Promise<Map<string, MediaAssetSize>> {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return new Map();
  const rows = await mediaAssetSizeQuery(db, unique);
  return new Map(rows.map((row) => [row.key, row]));
}
