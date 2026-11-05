import type { Database } from "@auction/db";
import { shopMediaAsset } from "@auction/db/schema";
import { sql } from "drizzle-orm";
import type {
  NewActiveMediaAsset,
  RegisterMediaAssetStore,
} from "../../application/artwork-register/register-media-assets.js";

/** Who is recorded as having added a picture that came from Zoho rather than from a person. */
const ZOHO_SYNC_ACTOR = "zoho-sync";

export function createDrizzleRegisterMediaAssetStore(db: Database): RegisterMediaAssetStore {
  return {
    async findUnregisteredKeys(limit) {
      const result = await db.execute<{ key: string }>(sql`
        SELECT DISTINCT k.key
        FROM artwork_register AS r
        CROSS JOIN LATERAL jsonb_array_elements_text(r.image_refs) AS k(key)
        WHERE NOT EXISTS (SELECT 1 FROM shop_media_asset AS a WHERE a.key = k.key)
        ORDER BY k.key
        LIMIT ${limit}
      `);
      return result.rows.map((row) => row.key);
    },
    async insertActive(asset: NewActiveMediaAsset) {
      await db
        .insert(shopMediaAsset)
        .values({
          key: asset.key,
          kind: "artwork_image",
          status: "active",
          contentType: asset.contentType,
          byteSize: asset.byteSize,
          width: asset.width,
          height: asset.height,
          blurDataUrl: asset.blurDataUrl,
          createdBySubjectId: ZOHO_SYNC_ACTOR,
        })
        .onConflictDoNothing();
    },
  };
}
