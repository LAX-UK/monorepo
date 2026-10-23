import type { Database } from "@auction/db";
import {
  shopFulfilment,
  shopOrder,
  shopOriginalSale,
  shopPayoutLedger,
  shopStockHold,
} from "@auction/db/schema";
import { and, eq, gt, inArray, isNull, notExists, notInArray, or, sql } from "drizzle-orm";
import type {
  ShopDeletionEligibilityReader,
  ShopDeletionOpenItems,
} from "../application/ports/deletion-eligibility.reader.js";
import { resolvePortalPartyIds } from "./portal-party-ids.js";

/** A fulfilment that has reached the buyer, or can no longer: nothing is owed on the order. */
const FINISHED_FULFILMENT = ["delivered", "collected", "in_storage", "cancelled"] as const;

async function count(query: Promise<{ n: number }[]>): Promise<number> {
  const [row] = await query;
  return row?.n ?? 0;
}

export function createDrizzleDeletionEligibilityRepository(
  db: Database,
): ShopDeletionEligibilityReader {
  return {
    async readOpenItems(identitySubjectId): Promise<ShopDeletionOpenItems> {
      const partyIds = await resolvePortalPartyIds(db, identitySubjectId);
      const now = new Date();

      const openOrders = count(
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(shopOrder)
          .where(
            and(
              eq(shopOrder.identitySubjectId, identitySubjectId),
              or(
                // Still awaiting payment, while the checkout can still be completed.
                and(
                  eq(shopOrder.status, "pending_payment"),
                  or(isNull(shopOrder.checkoutExpiresAt), gt(shopOrder.checkoutExpiresAt, now)),
                ),
                // Paid, but nothing has reached the buyer yet.
                and(
                  inArray(shopOrder.status, ["paid", "partially_refunded"]),
                  notExists(
                    db
                      .select({ one: sql`1` })
                      .from(shopFulfilment)
                      .where(
                        and(
                          eq(shopFulfilment.orderId, shopOrder.id),
                          inArray(shopFulfilment.status, FINISHED_FULFILMENT),
                        ),
                      ),
                  ),
                ),
              ),
            ),
          ),
      );

      // Party-linked records can only exist when the person has a party.
      if (partyIds.length === 0) {
        return {
          openOrders: await openOrders,
          pendingPayouts: 0,
          openOriginalSales: 0,
          activeHolds: 0,
        };
      }

      const pendingPayouts = count(
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(shopPayoutLedger)
          .where(
            and(
              inArray(shopPayoutLedger.ownerPartyId, partyIds),
              inArray(shopPayoutLedger.status, ["pending_refund_period", "due"]),
            ),
          ),
      );
      const openOriginalSales = count(
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(shopOriginalSale)
          .where(
            and(
              inArray(shopOriginalSale.buyerPartyId, partyIds),
              notInArray(shopOriginalSale.status, ["assigned", "cancelled"]),
            ),
          ),
      );
      const activeHolds = count(
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(shopStockHold)
          .where(
            and(
              inArray(shopStockHold.clientPartyId, partyIds),
              eq(shopStockHold.status, "active"),
              gt(shopStockHold.expiresAt, now),
            ),
          ),
      );

      const [orders, payouts, sales, holds] = await Promise.all([
        openOrders,
        pendingPayouts,
        openOriginalSales,
        activeHolds,
      ]);
      return {
        openOrders: orders,
        pendingPayouts: payouts,
        openOriginalSales: sales,
        activeHolds: holds,
      };
    },
  };
}
