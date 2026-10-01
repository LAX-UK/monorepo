import type { Database } from "@auction/db";
import { shopEdition, shopStockHold } from "@auction/db/schema";
import { and, eq, lte } from "drizzle-orm";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createStockHoldExpiryTask(db: Database): ShopSchedulerTask {
  return {
    name: "stock-hold-expiry",
    run: async (now) => {
      const expired = await db
        .select({ id: shopStockHold.id, editionId: shopStockHold.editionId })
        .from(shopStockHold)
        .where(and(eq(shopStockHold.status, "active"), lte(shopStockHold.expiresAt, now)))
        .limit(200);

      for (const hold of expired) {
        await db.transaction(async (tx) => {
          const updated = await tx
            .update(shopStockHold)
            .set({ status: "expired", releasedAt: now })
            .where(and(eq(shopStockHold.id, hold.id), eq(shopStockHold.status, "active")))
            .returning({ id: shopStockHold.id });
          if (updated.length !== 1) {
            return;
          }
          await tx
            .update(shopEdition)
            .set({ listingStatus: "authorised" })
            .where(and(eq(shopEdition.id, hold.editionId), eq(shopEdition.listingStatus, "held")));
        });
      }
    },
  };
}
