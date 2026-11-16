/**
 * Gives LAX Admin's Shop work lists an item to show: a paid order waiting to be fulfilled, a refund
 * waiting to be sent, and an open card dispute. The paid orders come from the numbered demo runs
 * (`seedEditionOrders`), which pay through the real checkout handler so the order, invoice and
 * fulfilment row are real.
 *
 * Idempotent: fixed keys and `on conflict do nothing`; it never changes an order a person has
 * already worked. Test and local databases only: it runs from the demo seed, behind its guard.
 */
import type { Database } from "@auction/db";
import { shopDispute, shopFulfilment, shopOrder, shopRefund } from "@auction/db/schema";
import { and, asc, eq, inArray, like } from "drizzle-orm";
import { seedEditionOrders } from "./edition-orders-seed.js";

const SEED_ORDER_KEY_PREFIX = "seed:edition-order:";
const REQUESTED_BY = "seed:demo-staff-queues";
const REFUND_KEY = "seed:demo-staff-queues:refund:0001";
const DISPUTE_ID = "dp_demo_example_shop_0001";
const PAID_STATUSES = ["paid", "partially_refunded"] as const;

export type DemoStaffQueueCounts = {
  paidOrders: number;
  ordersToFulfil: number;
  pendingRefunds: number;
  openDisputes: number;
};

/** Which paid order carries which item. With one paid order, it carries all of them. */
export function assignOrders<T>(orders: readonly T[]): {
  refund: T | undefined;
  dispute: T | undefined;
} {
  return { refund: orders[0], dispute: orders[1] ?? orders[0] };
}

export async function seedDemoStaffQueues(db: Database): Promise<DemoStaffQueueCounts> {
  await seedEditionOrders(db);
  const orders = await db
    .select({ id: shopOrder.id, totalPence: shopOrder.totalPence })
    .from(shopOrder)
    .where(
      and(
        like(shopOrder.idempotencyKey, `${SEED_ORDER_KEY_PREFIX}%`),
        inArray(shopOrder.status, [...PAID_STATUSES]),
      ),
    )
    .orderBy(asc(shopOrder.idempotencyKey));
  const { refund, dispute } = assignOrders(orders);

  if (refund) {
    await db
      .insert(shopRefund)
      .values({
        orderId: refund.id,
        amountPence: refund.totalPence,
        status: "pending",
        source: "admin",
        idempotencyKey: REFUND_KEY,
        requestedBySubjectId: REQUESTED_BY,
      })
      .onConflictDoNothing();
  }
  if (dispute) {
    await db
      .insert(shopDispute)
      .values({
        orderId: dispute.id,
        stripeDisputeId: DISPUTE_ID,
        status: "opened",
        amountPence: dispute.totalPence,
      })
      .onConflictDoNothing();
  }

  const orderIds = orders.map((o) => o.id);
  const toFulfil =
    orderIds.length === 0
      ? []
      : await db
          .select({ id: shopFulfilment.id })
          .from(shopFulfilment)
          .where(
            and(
              inArray(shopFulfilment.orderId, orderIds),
              inArray(shopFulfilment.status, [
                "pending_production",
                "in_production",
                "awaiting_dispatch",
              ]),
            ),
          );
  const [refunds, disputes] = await Promise.all([
    db
      .select({ id: shopRefund.id })
      .from(shopRefund)
      .where(eq(shopRefund.idempotencyKey, REFUND_KEY)),
    db
      .select({ id: shopDispute.id })
      .from(shopDispute)
      .where(eq(shopDispute.stripeDisputeId, DISPUTE_ID)),
  ]);
  return {
    paidOrders: orders.length,
    ordersToFulfil: toFulfil.length,
    pendingRefunds: refunds.length,
    openDisputes: disputes.length,
  };
}
