import type { Database } from "@auction/db";
import { shopEdition, shopStockHold } from "@auction/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { resolveListingStatusAfterReservationRelease } from "../../infrastructure/shop-edition-listing-on-release.js";
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
          const [edition] = await tx
            .select({
              artworkId: shopEdition.artworkId,
              ownerPartyId: shopEdition.ownerPartyId,
            })
            .from(shopEdition)
            .where(and(eq(shopEdition.id, hold.editionId), eq(shopEdition.listingStatus, "held")))
            .limit(1);
          if (edition) {
            const listingStatus = await resolveListingStatusAfterReservationRelease(tx, {
              artworkId: edition.artworkId,
              ownerPartyId: edition.ownerPartyId,
            });
            await tx
              .update(shopEdition)
              .set({ listingStatus })
              .where(
                and(eq(shopEdition.id, hold.editionId), eq(shopEdition.listingStatus, "held")),
              );
          }
        });
      }
    },
  };
}
