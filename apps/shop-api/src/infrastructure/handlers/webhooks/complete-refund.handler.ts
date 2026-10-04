import type { Database } from "@auction/db";
import {
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopProcessedPaymentEvent,
  shopRefund,
} from "@auction/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import type { StripeMoneyWebhookOutcome } from "../../../application/ports/stripe-money-webhook.types.js";
import { ShopPaymentWebhookError } from "../../../errors/shop-payment-webhook.error.js";
import { insertShopAdminAudit } from "../../shop-admin-audit.js";
import type { ShopDomainEventPublisherMode } from "../../shop-domain-event-publisher.js";
import { createShopDomainEventPublisher } from "../../shop-domain-event-publisher.js";

export type CompleteRefundWebhookInput = {
  eventId: string;
  stripeRefundId: string;
  paymentIntentId: string;
  amountPence: number;
  status: "succeeded" | "failed" | "pending" | "cancelled";
  shopRefundId?: string;
  source: "refund.created" | "refund.updated" | "refund.failed";
};

type RefundStatus = CompleteRefundWebhookInput["status"];

const REFUND_STATUS_RANK: Record<RefundStatus, number> = {
  pending: 0,
  cancelled: 1,
  failed: 2,
  succeeded: 3,
};

function mergeRefundStatus(current: RefundStatus, incoming: RefundStatus): RefundStatus {
  return REFUND_STATUS_RANK[incoming] >= REFUND_STATUS_RANK[current] ? incoming : current;
}

/** Splits order-level succeeded refunds across lines by unit price (last line gets rounding remainder). */
export function allocateOrderLevelRefundsToLines(
  orderLevelSucceededPence: number,
  lines: Array<{ id: string; unitPricePence: number }>,
): Map<string, number> {
  const allocated = new Map<string, number>();
  if (orderLevelSucceededPence <= 0 || lines.length === 0) {
    return allocated;
  }
  const orderTotal = lines.reduce((sum, line) => sum + line.unitPricePence, 0);
  if (orderTotal <= 0) {
    return allocated;
  }
  let assigned = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line) continue;
    const share =
      index === lines.length - 1
        ? orderLevelSucceededPence - assigned
        : Math.floor((orderLevelSucceededPence * line.unitPricePence) / orderTotal);
    allocated.set(line.id, share);
    assigned += share;
  }
  return allocated;
}

export function computeEffectiveLineRefundedPence(
  lines: Array<{ id: string; unitPricePence: number }>,
  succeededRefunds: Array<{ amountPence: number; orderLineId: string | null }>,
): Map<string, number> {
  const directByLine = new Map<string, number>();
  let orderLevelSucceeded = 0;
  for (const row of succeededRefunds) {
    if (row.orderLineId) {
      directByLine.set(row.orderLineId, (directByLine.get(row.orderLineId) ?? 0) + row.amountPence);
    } else {
      orderLevelSucceeded += row.amountPence;
    }
  }
  const orderLevelShare = allocateOrderLevelRefundsToLines(orderLevelSucceeded, lines);
  const effective = new Map<string, number>();
  for (const line of lines) {
    effective.set(line.id, (directByLine.get(line.id) ?? 0) + (orderLevelShare.get(line.id) ?? 0));
  }
  return effective;
}

async function resolveShopOrderForPaymentIntent(
  db: Database,
  paymentIntentId: string,
): Promise<{ orderId: string; totalPence: number } | null> {
  const [order] = await db
    .select({ id: shopOrder.id, totalPence: shopOrder.totalPence })
    .from(shopOrder)
    .where(eq(shopOrder.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (!order) return null;
  return { orderId: order.id, totalPence: order.totalPence };
}

function deriveOrderRefundStatus(
  orderTotalPence: number,
  succeededRefundTotal: number,
): "paid" | "partially_refunded" | "refunded" {
  if (succeededRefundTotal <= 0) return "paid";
  if (succeededRefundTotal >= orderTotalPence) return "refunded";
  return "partially_refunded";
}

async function recomputeOrderRefundStatus(tx: Database, orderId: string, orderTotalPence: number) {
  const refundRows = await tx
    .select({ amountPence: shopRefund.amountPence, status: shopRefund.status })
    .from(shopRefund)
    .where(eq(shopRefund.orderId, orderId));
  const succeededTotal = refundRows
    .filter((row) => row.status === "succeeded")
    .reduce((sum, row) => sum + row.amountPence, 0);
  const nextStatus = deriveOrderRefundStatus(orderTotalPence, succeededTotal);
  await tx.update(shopOrder).set({ status: nextStatus }).where(eq(shopOrder.id, orderId));
  return { nextStatus, succeededTotal };
}

async function applyPayoutEffectsForRefund(
  tx: Database,
  orderId: string,
  orderTotalPence: number,
  succeededTotal: number,
  events: ReturnType<typeof createShopDomainEventPublisher>,
): Promise<void> {
  const lines = await tx
    .select({
      id: shopOrderLine.id,
      unitPricePence: shopOrderLine.unitPricePence,
      editionId: shopOrderLine.editionId,
      sellerPartyId: shopOrderLine.sellerPartyId,
    })
    .from(shopOrderLine)
    .where(eq(shopOrderLine.orderId, orderId));
  if (lines.length === 0) return;

  const refundRows = await tx
    .select({
      amountPence: shopRefund.amountPence,
      orderLineId: shopRefund.orderLineId,
    })
    .from(shopRefund)
    .where(and(eq(shopRefund.orderId, orderId), eq(shopRefund.status, "succeeded")));

  const effectiveByLine = computeEffectiveLineRefundedPence(lines, refundRows);
  const orderFullyRefunded = succeededTotal >= orderTotalPence;

  for (const line of lines) {
    const lineRefunded = effectiveByLine.get(line.id) ?? 0;
    const lineFullyRefunded = orderFullyRefunded || lineRefunded >= line.unitPricePence;

    const payouts = await tx
      .select({ id: shopPayoutLedger.id, status: shopPayoutLedger.status })
      .from(shopPayoutLedger)
      .where(eq(shopPayoutLedger.orderLineId, line.id));

    for (const payout of payouts) {
      if (payout.status === "paid") {
        if (lineFullyRefunded || orderFullyRefunded) {
          await tx
            .update(shopPayoutLedger)
            .set({ blockedReason: "clawback" })
            .where(eq(shopPayoutLedger.id, payout.id));
        }
        continue;
      }
      if (lineFullyRefunded || orderFullyRefunded) {
        await tx
          .update(shopPayoutLedger)
          .set({ status: "cancelled", blockedReason: "refund" })
          .where(
            and(
              eq(shopPayoutLedger.id, payout.id),
              inArray(shopPayoutLedger.status, ["pending_refund_period", "due"]),
            ),
          );
      } else if (lineRefunded > 0) {
        await tx
          .update(shopPayoutLedger)
          .set({ blockedReason: "refund_review" })
          .where(
            and(
              eq(shopPayoutLedger.id, payout.id),
              inArray(shopPayoutLedger.status, ["pending_refund_period", "due"]),
            ),
          );
      }
    }
  }

  if (orderFullyRefunded) {
    for (const line of lines) {
      if (!line.editionId || !line.sellerPartyId) continue;
      await tx
        .update(shopEdition)
        .set({
          listingStatus: "withdrawn",
          ownerPartyId: line.sellerPartyId,
          custodyStatus: "with_owner",
        })
        .where(eq(shopEdition.id, line.editionId));

      await insertShopAdminAudit(tx, {
        actorSubjectId: "system:stripe-webhook",
        capability: "refund.write",
        action: "full_refund_edition_reversal",
        targetType: "shop_edition",
        targetId: line.editionId,
        afterJson: {
          orderId,
          listingStatus: "withdrawn",
          ownerPartyId: line.sellerPartyId,
        },
      });

      await events.insertInTransaction(tx, {
        aggregateType: "shop_edition",
        aggregateId: line.editionId,
        eventType: "shop.edition.released",
        producer: "shop-api",
        payload: {
          schemaVersion: 1,
          orderId,
          editionId: line.editionId,
        },
      });
    }
  }
}

/** Applies Stripe refund webhook side effects for a shop-owned payment intent. */
export async function completeRefundFromWebhook(
  db: Database,
  input: CompleteRefundWebhookInput,
  domainEventMode: ShopDomainEventPublisherMode,
): Promise<StripeMoneyWebhookOutcome> {
  const order = await resolveShopOrderForPaymentIntent(db, input.paymentIntentId);
  if (!order) {
    return "ignored";
  }

  const events = createShopDomainEventPublisher(domainEventMode);
  return db.transaction(async (tx) => {
    const [claim] = await tx
      .insert(shopProcessedPaymentEvent)
      .values({ eventId: input.eventId, source: "stripe" })
      .onConflictDoNothing()
      .returning({ eventId: shopProcessedPaymentEvent.eventId });
    if (!claim) return "duplicate";

    let [refund] = await tx
      .select({
        id: shopRefund.id,
        status: shopRefund.status,
        stripeRefundId: shopRefund.stripeRefundId,
      })
      .from(shopRefund)
      .where(eq(shopRefund.stripeRefundId, input.stripeRefundId))
      .limit(1);

    if (!refund && input.shopRefundId) {
      [refund] = await tx
        .select({
          id: shopRefund.id,
          status: shopRefund.status,
          stripeRefundId: shopRefund.stripeRefundId,
        })
        .from(shopRefund)
        .where(and(eq(shopRefund.id, input.shopRefundId), eq(shopRefund.orderId, order.orderId)))
        .limit(1);
    }

    if (!refund) {
      const inserted = await tx
        .insert(shopRefund)
        .values({
          orderId: order.orderId,
          amountPence: input.amountPence,
          status: input.status === "succeeded" ? "succeeded" : "pending",
          stripeRefundId: input.stripeRefundId,
          source: "stripe_dashboard",
          idempotencyKey: `stripe:${input.stripeRefundId}`,
          requestedBySubjectId: "system:stripe-webhook",
          submittedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({
          id: shopRefund.id,
          status: shopRefund.status,
          stripeRefundId: shopRefund.stripeRefundId,
        });
      refund = inserted[0];
      if (!refund) {
        [refund] = await tx
          .select({
            id: shopRefund.id,
            status: shopRefund.status,
            stripeRefundId: shopRefund.stripeRefundId,
          })
          .from(shopRefund)
          .where(
            or(
              eq(shopRefund.stripeRefundId, input.stripeRefundId),
              eq(shopRefund.idempotencyKey, `stripe:${input.stripeRefundId}`),
            ),
          )
          .limit(1);
      }
    }

    if (!refund) {
      throw new ShopPaymentWebhookError("refund_persist_failed", { retryable: true });
    }

    const nextStatus = mergeRefundStatus(refund.status as RefundStatus, input.status);
    const needsStripeId =
      refund.stripeRefundId === null || refund.stripeRefundId !== input.stripeRefundId;
    if (nextStatus !== refund.status || needsStripeId) {
      await tx
        .update(shopRefund)
        .set({
          status: nextStatus,
          stripeRefundId: input.stripeRefundId,
          updatedAt: new Date(),
        })
        .where(eq(shopRefund.id, refund.id));
    }

    const { succeededTotal } = await recomputeOrderRefundStatus(
      tx as Database,
      order.orderId,
      order.totalPence,
    );

    if (input.status === "succeeded") {
      await applyPayoutEffectsForRefund(
        tx as Database,
        order.orderId,
        order.totalPence,
        succeededTotal,
        events,
      );

      await events.insertInTransaction(tx as Database, {
        aggregateType: "shop_refund",
        aggregateId: refund.id,
        eventType: "shop.refund.completed",
        producer: "shop-api",
        payload: {
          schemaVersion: 1,
          refundId: refund.id,
          orderId: order.orderId,
          status: "succeeded",
        },
      });
    }

    return "processed";
  });
}
