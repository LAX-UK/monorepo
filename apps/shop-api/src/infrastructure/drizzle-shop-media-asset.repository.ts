import type { Database } from "@auction/db";
import { shopMediaAsset } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { ShopMediaAssetRepository } from "../application/ports/shop-media-asset.repository.js";

export function createDrizzleShopMediaAssetRepository(db: Database): ShopMediaAssetRepository {
  return {
    async insertPending(row) {
      await db.insert(shopMediaAsset).values({
        key: row.key,
        kind: row.kind,
        status: "pending",
        contentType: row.contentType,
        byteSize: row.byteSize,
        createdBySubjectId: row.createdBySubjectId,
      });
    },
    async markActive(row) {
      await db
        .update(shopMediaAsset)
        .set({
          status: "active",
          width: row.width,
          height: row.height,
          blurDataUrl: row.blurDataUrl,
          alt: row.alt,
          updatedAt: new Date(),
        })
        .where(eq(shopMediaAsset.key, row.key));
    },
    async markRejected(key) {
      await db
        .update(shopMediaAsset)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(shopMediaAsset.key, key));
    },
    async findByKey(key) {
      const rows = await db
        .select()
        .from(shopMediaAsset)
        .where(eq(shopMediaAsset.key, key))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        key: row.key,
        kind: row.kind,
        status: row.status,
        contentType: row.contentType,
        byteSize: row.byteSize,
        width: row.width,
        height: row.height,
        blurDataUrl: row.blurDataUrl,
        alt: row.alt,
        createdBySubjectId: row.createdBySubjectId,
      };
    },
  };
}
