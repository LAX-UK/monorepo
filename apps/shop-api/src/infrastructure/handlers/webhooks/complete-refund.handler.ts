import type { Database } from "@auction/db";
import { shopOrder, shopProcessedPaymentEvent, shopRefund } from "@auction/db/schema";
import { and, eq, or } from "drizzle-orm";
import type { ShopNotificationPublisher } from "../../../application/ports/shop-notification.publisher.js";
import type { StripeMoneyWebhookOutcome } from "../../../application/ports/stripe-money-webhook.types.js";
import { ShopPaymentWebhookError } from "../../../errors/shop-payment-webhook.error.js";
import {
  applyPayoutEffectsForRefund,
  recomputeOrderRefundStatus,
} from "../../refund-settlement.js";
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

async function resolveShopOrderForPaymentIntent(
  db: Database,
  paymentIntentId: string,
): Promise<{
  orderId: string;
  reference: string;
  totalPence: number;
  identitySubjectId: string;
} | null> {
  const [order] = await db
    .select({
      id: shopOrder.id,
      reference: shopOrder.reference,
      totalPence: shopOrder.totalPence,
      identitySubjectId: shopOrder.identitySubjectId,
    })
    .from(shopOrder)
    .where(eq(shopOrder.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (!order) return null;
  return {
    orderId: order.id,
    reference: order.reference,
    totalPence: order.totalPence,
    identitySubjectId: order.identitySubjectId,
  };
}

/** Applies Stripe refund webhook side effects for a shop-owned payment intent. */
export async function completeRefundFromWebhook(
  db: Database,
  input: CompleteRefundWebhookInput,
  domainEventMode: ShopDomainEventPublisherMode,
  options?: { notifications?: ShopNotificationPublisher },
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

      if (options?.notifications) {
        await options.notifications.queueRefundIssued(tx as Database, {
          idempotencyKey: `refund-email:${input.stripeRefundId}`,
          identitySubjectId: order.identitySubjectId,
          fallbackEmail: null,
          orderId: order.orderId,
          orderReference: order.reference,
          amountPence: input.amountPence,
        });
      }
    }

    return "processed";
  });
}
