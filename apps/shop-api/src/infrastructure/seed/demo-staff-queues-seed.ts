/**
 * Gives LAX Admin's Shop work lists an item to show, through the code staff and Stripe use:
 *
 * - **Fulfilment** (`/fulfilment`, the "To fulfil" tile): the paid orders of the numbered demo
 *   runs (`seedEditionOrders`), which pay through the real checkout handler.
 * - **Failed refunds** (the "Failed refunds" tile, `/orders?refund=failed`): a refund requested
 *   through the staff request-refund handler (audit entry and `shop.refund.requested` event). The
 *   demo orders were paid without Stripe, so they have no payment intent and a refund of them can
 *   never be sent. The scheduler would find that out on its first run and report it to Sentry and
 *   the ops inbox; the seed records the same outcome itself, in the same transaction as the
 *   request, so the refund is never pending and the scheduler never picks it up.
 * - **Disputes** (`/disputes`): a dispute recorded by the Stripe dispute recorder (processed-event
 *   claim, dispute row, payout block, `shop.dispute.opened` event), with no ops alert.
 *
 * The events the real handlers write here carry the producer `shop-api`, not `demo-seed`. No
 * worker projector or fan-out consumes `shop.refund.requested` or `shop.dispute.opened` today; a
 * consumer added later must skip these demo rows itself.
 *
 * Insert-once: each item is created only if its fixed key is absent, and nothing it created is
 * changed on a later run, so work staff did on an item (a retried refund, a closed dispute) stays.
 * Test and local databases only: it refuses a database without the demo seed mark (0398).
 */
import { type Database, assertDemoSeedDatabase } from "@auction/db";
import { shopDispute, shopFulfilment, shopOrder, shopRefund } from "@auction/db/schema";
import { and, asc, eq, inArray, isNull, like } from "drizzle-orm";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { createRequestRefundHandler } from "../handlers/admin/request-refund.handler.js";
import { recordStripeDisputeForOrder } from "../handlers/webhooks/stripe-dispute.handler.js";
import { seedEditionOrders } from "./edition-orders-seed.js";

const SEED_ORDER_KEY_PREFIX = "seed:edition-order:";
/** The staff subject the seeded refund is requested as; it reads as the seed in the audit trail. */
export const DEMO_QUEUES_ACTOR = "seed:demo-staff-queues";
export const DEMO_REFUND_KEY = "seed:demo-staff-queues:refund:0001";
export const DEMO_DISPUTE_ID = "dp_demo_example_shop_0001";
export const DEMO_DISPUTE_EVENT_ID = "evt_demo_example_shop_dispute_0001";
/** Invented payment intent of the demo dispute's order (Stripe-style, nothing real). */
const DEMO_DISPUTE_PAYMENT_INTENT = "pi_demo_example_shop_0001";
/** What the scheduler records when a refund's order has no payment intent (a terminal failure). */
export const MISSING_INTENT_ERROR = "Order missing stripe_payment_intent_id";
const PAID_STATUSES = ["paid", "partially_refunded"] as const;
const OPEN_FULFILMENT = ["pending_production", "in_production", "awaiting_dispatch"] as const;

export type DemoStaffQueueCounts = {
  paidOrders: number;
  ordersToFulfil: number;
  failedRefunds: number;
  openDisputes: number;
};

/** Which paid order carries which item. With one paid order, it carries both. */
export function assignOrders<T>(orders: readonly T[]): {
  refund: T | undefined;
  dispute: T | undefined;
} {
  return { refund: orders[0], dispute: orders[1] ?? orders[0] };
}

/** A goodwill part refund: a quarter of the order, so it never takes the whole order or a frame. */
export function demoRefundPence(totalPence: number): number {
  return Math.max(1, Math.floor(totalPence / 4));
}

export async function seedDemoStaffQueues(db: Database): Promise<DemoStaffQueueCounts> {
  await assertDemoSeedDatabase(db, "shop demo staff queues");
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

  if (refund) await seedFailedRefund(db, refund);
  if (dispute) {
    // The dispute names the payment intent its order was paid with, as the webhook would match it.
    // Only an order that has none yet is given one. The refund (requested above) already holds its
    // failed outcome, so it is not retried because of this.
    await db
      .update(shopOrder)
      .set({ stripePaymentIntentId: DEMO_DISPUTE_PAYMENT_INTENT })
      .where(and(eq(shopOrder.id, dispute.id), isNull(shopOrder.stripePaymentIntentId)));
    await recordStripeDisputeForOrder(
      db,
      { orderId: dispute.id },
      {
        eventId: DEMO_DISPUTE_EVENT_ID,
        stripeDisputeId: DEMO_DISPUTE_ID,
        paymentIntentId: DEMO_DISPUTE_PAYMENT_INTENT,
        amountPence: dispute.totalPence,
        status: "opened",
      },
      // No notifications: the seed raises no ops alert email.
      { domainEventMode: "enforce" },
    );
  }

  return countQueues(db);
}

/** Requests the refund as staff would, then records the scheduler's terminal outcome for it. */
async function seedFailedRefund(db: Database, order: { id: string; totalPence: number }) {
  const [existing] = await db
    .select({ id: shopRefund.id })
    .from(shopRefund)
    .where(eq(shopRefund.idempotencyKey, DEMO_REFUND_KEY))
    .limit(1);
  if (existing) return;
  await db.transaction(async (tx) => {
    const requestRefund = createRequestRefundHandler({
      uow: createDrizzleShopUnitOfWork(tx as Database, "enforce"),
    });
    const { refundId } = await requestRefund({
      orderId: order.id,
      amountPence: demoRefundPence(order.totalPence),
      actorSubjectId: DEMO_QUEUES_ACTOR,
      idempotencyKey: DEMO_REFUND_KEY,
      reason: "goodwill",
      note: "Demo data: a goodwill part refund for a late delivery.",
    });
    // Only the row just requested, still untouched: a pending refund with no Stripe id.
    await tx
      .update(shopRefund)
      .set({ status: "failed", submitAttempts: 1, lastError: MISSING_INTENT_ERROR })
      .where(
        and(
          eq(shopRefund.id, refundId),
          eq(shopRefund.status, "pending"),
          eq(shopRefund.submitAttempts, 0),
        ),
      );
  });
}

async function countQueues(db: Database): Promise<DemoStaffQueueCounts> {
  const orders = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(
      and(
        like(shopOrder.idempotencyKey, `${SEED_ORDER_KEY_PREFIX}%`),
        inArray(shopOrder.status, [...PAID_STATUSES]),
      ),
    );
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
              inArray(shopFulfilment.status, [...OPEN_FULFILMENT]),
            ),
          );
  const [refunds, disputes] = await Promise.all([
    db
      .select({ id: shopRefund.id })
      .from(shopRefund)
      .where(and(eq(shopRefund.idempotencyKey, DEMO_REFUND_KEY), eq(shopRefund.status, "failed"))),
    db
      .select({ id: shopDispute.id })
      .from(shopDispute)
      .where(
        and(eq(shopDispute.stripeDisputeId, DEMO_DISPUTE_ID), eq(shopDispute.status, "opened")),
      ),
  ]);
  return {
    paidOrders: orders.length,
    ordersToFulfil: toFulfil.length,
    failedRefunds: refunds.length,
    openDisputes: disputes.length,
  };
}
