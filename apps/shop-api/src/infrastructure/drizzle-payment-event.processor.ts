import type { Database } from "@auction/db";
import {
  domainEvent,
  shopArtwork,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopPayoutLedger,
  shopProcessedPaymentEvent,
} from "@auction/db/schema";
import { computePayoutDueAt, computeRefundPeriodEndsAt } from "@auction/shop-domain";
import { and, eq, inArray } from "drizzle-orm";
import type { PaymentEventProcessor } from "../application/ports/payment-event.processor.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { ShopPaymentWebhookError } from "../errors/shop-payment-webhook.error.js";
import { findOrCreateBuyerParty } from "./shop-party.js";

type CheckoutTransitionOptions = {
  notifications?: ShopNotificationPublisher;
  storefrontUrl?: string;
  fallbackCustomerEmail?: string | null;
};

export function createDrizzlePaymentEventProcessor(
  db: Database,
  options: CheckoutTransitionOptions = {},
): PaymentEventProcessor {
  return {
    completeCheckout: (input) =>
      completeShopCheckoutSession(db, input, {
        ...options,
        fallbackCustomerEmail: input.customerEmail ?? options.fallbackCustomerEmail ?? null,
      }),
    expireCheckout: (input) =>
      expireShopCheckoutSession(db, { ...input, source: input.source ?? "stripe" }),
    failCheckout: (input) =>
      failShopCheckoutSession(db, { ...input, source: input.source ?? "stripe" }),
  };
}

async function releaseReservedEditionsForOrder(tx: Database, orderId: string): Promise<void> {
  const lines = await tx.select().from(shopOrderLine).where(eq(shopOrderLine.orderId, orderId));
  const editionIds = lines.map((line) => line.editionId);
  if (editionIds.length === 0) {
    return;
  }
  await tx
    .update(shopEdition)
    .set({ status: "available", reservedUntil: null, reservedByOrderId: null })
    .where(
      and(
        inArray(shopEdition.id, editionIds),
        eq(shopEdition.status, "reserved"),
        eq(shopEdition.reservedByOrderId, orderId),
      ),
    );
  for (const line of lines) {
    await tx.insert(domainEvent).values({
      aggregateType: "shop_edition",
      aggregateId: line.editionId,
      eventType: "shop.edition.released",
      payload: { orderId, editionId: line.editionId },
      producer: "shop-api",
    });
  }
}

export async function completeShopCheckoutSession(
  db: Database,
  input: {
    eventId: string;
    orderId: string;
    amountTotalPence: number;
    paidAt: Date;
    customerEmail?: string | null;
  },
  options: CheckoutTransitionOptions = {},
): Promise<"processed" | "duplicate"> {
  return db.transaction(async (tx) => {
    const [claim] = await tx
      .insert(shopProcessedPaymentEvent)
      .values({ eventId: input.eventId, source: "stripe" })
      .onConflictDoNothing()
      .returning({ eventId: shopProcessedPaymentEvent.eventId });
    if (!claim) return "duplicate";

    const locked = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, input.orderId))
      .for("update")
      .limit(1);
    const order = locked[0];
    if (!order) {
      throw new ShopPaymentWebhookError("payment_not_found", { retryable: false });
    }
    if (order.totalPence !== input.amountTotalPence) {
      throw new ShopPaymentWebhookError("amount_mismatch", { retryable: false });
    }
    if (order.status === "paid") return "processed";
    if (order.status !== "pending_payment") {
      throw new ShopPaymentWebhookError("payment_state_invalid", { retryable: true });
    }

    const buyerPartyId = await findOrCreateBuyerParty(
      tx as Database,
      order.identitySubjectId,
      "Shop buyer",
    );

    await tx
      .update(shopOrder)
      .set({
        status: "paid",
        paidAt: input.paidAt,
        buyerPartyId,
        refundPeriodEndsAt: computeRefundPeriodEndsAt(input.paidAt),
        updatedAt: new Date(),
      })
      .where(eq(shopOrder.id, order.id));

    const lines = await tx.select().from(shopOrderLine).where(eq(shopOrderLine.orderId, order.id));
    for (const line of lines) {
      const updated = await tx
        .update(shopEdition)
        .set({
          status: "sold",
          ownerPartyId: buyerPartyId,
          reservedUntil: null,
          reservedByOrderId: null,
        })
        .where(
          and(
            eq(shopEdition.id, line.editionId),
            eq(shopEdition.status, "reserved"),
            eq(shopEdition.reservedByOrderId, order.id),
          ),
        )
        .returning({ id: shopEdition.id });
      if (updated.length !== 1) {
        throw new ShopPaymentWebhookError("edition_state_invalid", { retryable: false });
      }
    }

    const payoutDueAt = computePayoutDueAt(computeRefundPeriodEndsAt(input.paidAt));
    for (const line of lines) {
      await tx.insert(shopPayoutLedger).values({
        orderLineId: line.id,
        ownerPartyId: line.sellerPartyId,
        grossPence: line.unitPricePence,
        deductionsPence: 0,
        netPence: line.unitPricePence,
        payoutDueAt,
      });
      await tx.insert(domainEvent).values({
        aggregateType: "shop_order_line",
        aggregateId: line.id,
        eventType: "shop.edition.sold",
        payload: { orderId: order.id, editionId: line.editionId },
        producer: "shop-api",
      });
    }

    if (options.notifications && options.storefrontUrl) {
      const lineDetails = await tx
        .select({
          title: shopArtwork.title,
          slug: shopArtwork.slug,
          editionNumber: shopOrderLine.editionNumber,
          unitPricePence: shopOrderLine.unitPricePence,
        })
        .from(shopOrderLine)
        .innerJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
        .where(eq(shopOrderLine.orderId, order.id));

      await options.notifications.queueOrderReceipt(tx, {
        idempotencyKey: `order-receipt:${order.id}`,
        identitySubjectId: order.identitySubjectId,
        fallbackEmail: options.fallbackCustomerEmail ?? null,
        orderId: order.id,
        totalPence: order.totalPence,
        storefrontUrl: options.storefrontUrl,
        lines: lineDetails.map((line) => ({
          artworkTitle: line.title,
          artworkSlug: line.slug,
          editionNumber: line.editionNumber,
          unitPricePence: line.unitPricePence,
        })),
      });
    }

    return "processed";
  });
}

export async function expireShopCheckoutSession(
  db: Database,
  input: { eventId: string; orderId: string; source?: string },
): Promise<"processed" | "duplicate"> {
  const source = input.source ?? "stripe";
  return db.transaction(async (tx) => {
    const [claim] = await tx
      .insert(shopProcessedPaymentEvent)
      .values({ eventId: input.eventId, source })
      .onConflictDoNothing()
      .returning({ eventId: shopProcessedPaymentEvent.eventId });
    if (!claim) return "duplicate";

    const locked = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, input.orderId))
      .for("update")
      .limit(1);
    const order = locked[0];
    if (!order || order.status !== "pending_payment") {
      return "processed";
    }
    await tx
      .update(shopOrder)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(shopOrder.id, input.orderId));
    await releaseReservedEditionsForOrder(tx as Database, input.orderId);
    return "processed";
  });
}

export async function failShopCheckoutSession(
  db: Database,
  input: { eventId: string; orderId: string; source?: string },
): Promise<"processed" | "duplicate"> {
  const source = input.source ?? "stripe";
  return db.transaction(async (tx) => {
    const [claim] = await tx
      .insert(shopProcessedPaymentEvent)
      .values({ eventId: input.eventId, source })
      .onConflictDoNothing()
      .returning({ eventId: shopProcessedPaymentEvent.eventId });
    if (!claim) return "duplicate";

    const locked = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, input.orderId))
      .for("update")
      .limit(1);
    const order = locked[0];
    if (!order || order.status !== "pending_payment") {
      return "processed";
    }
    await tx
      .update(shopOrder)
      .set({ status: "payment_failed", updatedAt: new Date() })
      .where(eq(shopOrder.id, input.orderId));
    await releaseReservedEditionsForOrder(tx as Database, input.orderId);
    return "processed";
  });
}
