import type { Database } from "@auction/db";
import { shopOrder } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import type { OrderPaymentStateReader } from "../application/ports/zoho-mirror.ports.js";

/**
 * Whether orders are paid, as the order mirror decides it (`paid_at` is set). One query by the
 * primary key for a whole batch.
 */
export function createDrizzleOrderPaymentStateReader(db: Database): OrderPaymentStateReader {
  return {
    async paidOf(orderIds) {
      if (orderIds.length === 0) return new Map();
      const rows = await db
        .select({ id: shopOrder.id, paidAt: shopOrder.paidAt })
        .from(shopOrder)
        .where(inArray(shopOrder.id, [...orderIds]));
      return new Map(rows.map((row) => [row.id, row.paidAt !== null]));
    },
  };
}
