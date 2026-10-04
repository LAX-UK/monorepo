import type { Database } from "@auction/db";
import {
  shopDispute,
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopProcessedPaymentEvent,
} from "@auction/db/schema";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { ShopNotificationPublisher } from "../../../application/ports/shop-notification.publisher.js";
import type { StripeMoneyWebhookOutcome } from "../../../application/ports/stripe-money-webhook.types.js";
import { createShopDomainEventPublisher } from "../../shop-domain-event-publisher.js";
import type { ShopDomainEventPublisherMode } from "../../shop-domain-event-publisher.js";

export type StripeDisputeWebhookInput = {
  eventId: string;
  stripeDisputeId: string;
  paymentIntentId: string;
  amountPence: number;
  status: "opened" | "closed";
  outcome?: "won" | "lost";
};

async function resolveShopOrderForPaymentIntent(
  db: Database,
  paymentIntentId: string,
): Promise<{ orderId: string } | null> {
  const [order] = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(eq(shopOrder.stripePaymentIntentId, paymentIntentId))
    .limit(1);
  if (!order) return null;
  return { orderId: order.id };
}

export async function handleStripeDisputeWebhook(
  db: Database,
  input: StripeDisputeWebhookInput,
  options: {
    domainEventMode: ShopDomainEventPublisherMode;
    notifications?: ShopNotificationPublisher;
    opsAlertEmail?: string | null;
  },
): Promise<StripeMoneyWebhookOutcome> {
  const order = await resolveShopOrderForPaymentIntent(db, input.paymentIntentId);
  if (!order) return "ignored";

  const events = createShopDomainEventPublisher(options.domainEventMode);
  return db.transaction(async (tx) => {
    const [claim] = await tx
      .insert(shopProcessedPaymentEvent)
      .values({ eventId: input.eventId, source: "stripe" })
      .onConflictDoNothing()
      .returning({ eventId: shopProcessedPaymentEvent.eventId });
    if (!claim) return "duplicate";

    const disputeStatus =
      input.outcome === "won" ? "won" : input.outcome === "lost" ? "lost" : "opened";

    const [disputeRow] = await tx
      .insert(shopDispute)
      .values({
        orderId: order.orderId,
        stripeDisputeId: input.stripeDisputeId,
        amountPence: input.amountPence,
        status: disputeStatus,
        ...(input.status === "closed" ? { closedAt: new Date() } : {}),
      })
      .onConflictDoUpdate({
        target: shopDispute.stripeDisputeId,
        set: {
          status: disputeStatus,
          ...(input.status === "closed" ? { closedAt: new Date() } : {}),
        },
      })
      .returning({ id: shopDispute.id });

    if (!disputeRow) {
      throw new Error("Failed to upsert shop dispute");
    }

    const lineIds = (
      await tx
        .select({ id: shopOrderLine.id })
        .from(shopOrderLine)
        .where(eq(shopOrderLine.orderId, order.orderId))
    ).map((row) => row.id);

    if (lineIds.length > 0) {
      if (input.status === "closed" && input.outcome === "won") {
        await tx
          .update(shopPayoutLedger)
          .set({ blockedReason: null })
          .where(
            and(
              inArray(shopPayoutLedger.orderLineId, lineIds),
              eq(shopPayoutLedger.blockedReason, "dispute"),
            ),
          );
      } else if (input.status === "closed" && input.outcome === "lost") {
        await tx
          .update(shopPayoutLedger)
          .set({ blockedReason: "clawback" })
          .where(
            and(
              inArray(shopPayoutLedger.orderLineId, lineIds),
              eq(shopPayoutLedger.status, "paid"),
            ),
          );
        await tx
          .update(shopPayoutLedger)
          .set({ status: "cancelled", blockedReason: "dispute_lost" })
          .where(
            and(
              inArray(shopPayoutLedger.orderLineId, lineIds),
              inArray(shopPayoutLedger.status, ["pending_refund_period", "due"]),
            ),
          );
      } else if (input.status === "opened") {
        await tx
          .update(shopPayoutLedger)
          .set({ blockedReason: "dispute" })
          .where(
            and(
              inArray(shopPayoutLedger.orderLineId, lineIds),
              inArray(shopPayoutLedger.status, ["pending_refund_period", "due"]),
              or(isNull(shopPayoutLedger.blockedReason), eq(shopPayoutLedger.blockedReason, "")),
            ),
          );
      }
    }

    if (input.status === "closed") {
      await events.insertInTransaction(tx as Database, {
        aggregateType: "shop_dispute",
        aggregateId: disputeRow.id,
        eventType: "shop.dispute.closed",
        producer: "shop-api",
        payload: {
          schemaVersion: 1,
          disputeId: disputeRow.id,
          orderId: order.orderId,
          status: input.outcome === "won" ? "won" : input.outcome === "lost" ? "lost" : "closed",
        },
      });
    } else {
      await events.insertInTransaction(tx as Database, {
        aggregateType: "shop_dispute",
        aggregateId: disputeRow.id,
        eventType: "shop.dispute.opened",
        producer: "shop-api",
        payload: {
          schemaVersion: 1,
          disputeId: disputeRow.id,
          orderId: order.orderId,
          stripeDisputeId: input.stripeDisputeId,
        },
      });
    }

    const opsEmail = options.opsAlertEmail?.trim();
    if (options.notifications && opsEmail?.includes("@")) {
      await options.notifications.queueCheckoutOpsAlert(tx as Database, {
        idempotencyKey: `dispute:${input.eventId}`,
        opsEmail,
        alertKind: "Shop Stripe dispute",
        orderId: order.orderId,
        detail: `Dispute ${input.stripeDisputeId} on payment intent ${input.paymentIntentId}${
          input.outcome === "lost" ? " (lost — clawback review)" : ""
        }`,
      });
    }

    return "processed";
  });
}
