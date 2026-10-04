import type { Database } from "@auction/db";
import { shopEdition, shopStockHold } from "@auction/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { insertShopAdminAudit } from "../shop-admin-audit.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";
import { resolveListingStatusAfterReservationRelease } from "../shop-edition-listing-on-release.js";

export function createExpireHoldsRunner(
  db: Database,
  domainEventMode: ShopDomainEventPublisherMode = "off",
): (now: Date) => Promise<number> {
  const events = createShopDomainEventPublisher(domainEventMode);
  return async (now) => {
    const expired = await db
      .select({ id: shopStockHold.id, editionId: shopStockHold.editionId })
      .from(shopStockHold)
      .where(and(eq(shopStockHold.status, "active"), lte(shopStockHold.expiresAt, now)))
      .limit(200)
      .for("update", { skipLocked: true });

    let count = 0;
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
            .where(eq(shopEdition.id, hold.editionId));
        }
        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: "system:shop-scheduler",
          capability: "stock_hold.write",
          action: "expire_hold",
          targetType: "shop_stock_hold",
          targetId: hold.id,
          afterJson: { editionId: hold.editionId, expiredAt: now.toISOString() },
        });
        await events.insertInTransaction(tx as Database, {
          aggregateType: "shop_stock_hold",
          aggregateId: hold.id,
          eventType: "shop.stock_hold.expired",
          producer: "shop-api",
          payload: {
            schemaVersion: 1,
            holdId: hold.id,
            editionId: hold.editionId,
          },
        });
        count += 1;
      });
    }
    return count;
  };
}
