import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopParty,
  shopPayoutLedger,
  shopProcessedPaymentEvent,
} from "@auction/db/schema";
import { computePayoutDueAt } from "@auction/shop-domain";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PaymentCheckoutGateway } from "../application/ports/commerce.ports.js";
import type { PaymentEventProcessor } from "../application/ports/payment-event.processor.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { ShopPaymentWebhookError } from "../errors/shop-payment-webhook.error.js";
import {
  assertCheckoutNotAlreadyPaid,
  assertCheckoutNotAsyncPending,
  expireHostedCheckoutSession,
  isAsyncCheckoutPaymentPending,
} from "./shop-checkout-stripe-expiry.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "./shop-domain-event-publisher.js";
import { resolveListingStatusAfterReservationRelease } from "./shop-edition-listing-on-release.js";
import { findOrCreateBuyerParty } from "./shop-party.js";
import { restoreBasketLinesFromOrder } from "./shop-restore-basket-from-order.js";

type CheckoutTransitionOptions = {
  notifications?: ShopNotificationPublisher;
  opsAlertEmail?: string | null;
  storefrontUrl?: string;
  fallbackCustomerEmail?: string | null;
  paymentGateway?: PaymentCheckoutGateway;
  domainEventMode?: ShopDomainEventPublisherMode;
};

async function queueCheckoutOpsAlertInTx(
  tx: Database,
  options: CheckoutTransitionOptions,
  input: {
    idempotencyKey: string;
    alertKind: string;
    orderId: string;
    detail: string;
  },
): Promise<void> {
  const opsEmail = options.opsAlertEmail?.trim();
  if (!options.notifications || !opsEmail?.includes("@")) return;
  await options.notifications.queueCheckoutOpsAlert(tx, {
    idempotencyKey: input.idempotencyKey,
    opsEmail,
    alertKind: input.alertKind,
    orderId: input.orderId,
    detail: input.detail,
  });
}

function assertStripeSessionMatchesOrder(
  order: { stripeCheckoutSessionId: string | null },
  sessionId: string,
): void {
  if (!order.stripeCheckoutSessionId) {
    return;
  }
  if (order.stripeCheckoutSessionId !== sessionId) {
    throw new ShopPaymentWebhookError("session_mismatch", { retryable: false });
  }
}

async function expireStripeBeforeLocalTransition(
  db: Database,
  orderId: string,
  paymentGateway: PaymentCheckoutGateway | undefined,
  mode: "buyer_cancel" | "expire",
): Promise<"proceed" | "skip_async"> {
  if (!paymentGateway) {
    return "proceed";
  }
  const [preview] = await db
    .select({
      status: shopOrder.status,
      stripeCheckoutSessionId: shopOrder.stripeCheckoutSessionId,
    })
    .from(shopOrder)
    .where(eq(shopOrder.id, orderId))
    .limit(1);
  if (!preview || preview.status !== "pending_payment") {
    return "proceed";
  }
  const outcome = await expireHostedCheckoutSession(paymentGateway, {
    orderId,
    sessionId: preview.stripeCheckoutSessionId,
  });
  if (isAsyncCheckoutPaymentPending(outcome)) {
    if (mode === "buyer_cancel") {
      assertCheckoutNotAsyncPending(outcome);
    }
    return "skip_async";
  }
  assertCheckoutNotAlreadyPaid(outcome);
  return "proceed";
}

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
    expireCheckout: async (input) => {
      const outcome = await expireShopCheckoutSession(
        db,
        { ...input, source: input.source ?? "stripe" },
        options,
      );
      return outcome === "duplicate" ? "duplicate" : "processed";
    },
    failCheckout: (input) =>
      failShopCheckoutSession(db, { ...input, source: input.source ?? "stripe" }, options),
    recordCurrencyViolation: (input) => recordShopCheckoutCurrencyViolation(db, input, options),
  };
}

async function releaseReservedEditionsForOrder(
  tx: Database,
  orderId: string,
  events: ReturnType<typeof createShopDomainEventPublisher>,
): Promise<void> {
  const lines = await tx.select().from(shopOrderLine).where(eq(shopOrderLine.orderId, orderId));
  const editionLines = lines.filter(
    (line): line is typeof line & { editionId: string } => line.editionId !== null,
  );
  const editionIds = editionLines.map((line) => line.editionId);
  if (editionIds.length === 0) {
    return;
  }
  const releasedAt = new Date();
  const candidates = await tx
    .select({
      id: shopEdition.id,
      artworkId: shopEdition.artworkId,
      ownerPartyId: shopEdition.ownerPartyId,
    })
    .from(shopEdition)
    .where(
      and(
        inArray(shopEdition.id, editionIds),
        eq(shopEdition.listingStatus, "reserved"),
        eq(shopEdition.reservedByOrderId, orderId),
      ),
    );
  const releasedEditionIds: { id: string }[] = [];
  for (const edition of candidates) {
    const listingStatus = await resolveListingStatusAfterReservationRelease(tx, {
      artworkId: edition.artworkId,
      ownerPartyId: edition.ownerPartyId,
    });
    const [updated] = await tx
      .update(shopEdition)
      .set({
        listingStatus,
        reservedUntil: null,
        reservedByOrderId: null,
      })
      .where(eq(shopEdition.id, edition.id))
      .returning({ id: shopEdition.id });
    if (updated) {
      releasedEditionIds.push(updated);
    }
  }
  await tx
    .update(shopOrderLine)
    .set({ releasedAt })
    .where(and(eq(shopOrderLine.orderId, orderId), isNull(shopOrderLine.releasedAt)));
  for (const row of releasedEditionIds) {
    await events.insertInTransaction(tx, {
      aggregateType: "shop_edition",
      aggregateId: row.id,
      eventType: "shop.edition.released",
      producer: "shop-api",
      payload: { schemaVersion: 1, orderId, editionId: row.id },
    });
  }
}

export async function completeShopCheckoutSession(
  db: Database,
  input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    amountTotalPence: number;
    paidAt: Date;
    customerEmail?: string | null;
  },
  options: CheckoutTransitionOptions = {},
): Promise<"processed" | "duplicate" | "terminal_acknowledged"> {
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
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
      await queueCheckoutOpsAlertInTx(tx as Database, options, {
        idempotencyKey: `terminal-paid:${input.eventId}`,
        alertKind: "Paid webhook for terminal order",
        orderId: input.orderId,
        detail: `Stripe session ${input.sessionId} paid while order status is ${order.status}. Manual refund review may be required.`,
      });
      return "terminal_acknowledged";
    }
    assertStripeSessionMatchesOrder(order, input.sessionId);

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
        refundPeriodEndsAt: null,
        updatedAt: new Date(),
      })
      .where(eq(shopOrder.id, order.id));

    await tx
      .insert(shopFulfilment)
      .values({
        orderId: order.id,
        option: order.fulfilment,
        status: "pending_production",
      })
      .onConflictDoNothing({ target: shopFulfilment.orderId });

    const lines = await tx.select().from(shopOrderLine).where(eq(shopOrderLine.orderId, order.id));
    const editionLines = lines.filter(
      (line): line is typeof line & { editionId: string; sellerPartyId: string } =>
        line.editionId !== null && line.sellerPartyId !== null,
    );
    for (const line of editionLines) {
      const updated = await tx
        .update(shopEdition)
        .set({
          listingStatus: "sold",
          ownerPartyId: buyerPartyId,
          reservedUntil: null,
          reservedByOrderId: null,
        })
        .where(
          and(
            eq(shopEdition.id, line.editionId),
            eq(shopEdition.listingStatus, "reserved"),
            eq(shopEdition.reservedByOrderId, order.id),
          ),
        )
        .returning({ id: shopEdition.id });
      if (updated.length !== 1) {
        throw new ShopPaymentWebhookError("edition_state_invalid", { retryable: false });
      }
    }

    /** Placeholder until possession sets cancellation end; far-future avoids misleading near-term due dates. */
    const payoutDueAt = computePayoutDueAt(
      new Date(input.paidAt.getTime() + 10 * 365 * 24 * 60 * 60 * 1000),
    );
    const sellerPartyIds = [...new Set(editionLines.map((line) => line.sellerPartyId))];
    const sellerParties =
      sellerPartyIds.length > 0
        ? await tx
            .select({ id: shopParty.id, kind: shopParty.kind })
            .from(shopParty)
            .where(inArray(shopParty.id, sellerPartyIds))
        : [];
    const sellerKindById = new Map(sellerParties.map((row) => [row.id, row.kind]));

    for (const line of editionLines) {
      if (sellerKindById.get(line.sellerPartyId) !== "lax") {
        await tx.insert(shopPayoutLedger).values({
          orderLineId: line.id,
          ownerPartyId: line.sellerPartyId,
          grossPence: line.unitPricePence,
          deductionsPence: 0,
          netPence: line.unitPricePence,
          payoutDueAt,
          blockedReason: "pending_possession",
          cancellationPeriodEndsAt: null,
        });
      }
      await events.insertInTransaction(tx, {
        aggregateType: "shop_order_line",
        aggregateId: line.id,
        eventType: "shop.edition.sold",
        producer: "shop-api",
        payload: {
          schemaVersion: 1,
          orderId: order.id,
          editionId: line.editionId,
          buyerPartyId,
        },
      });
    }

    await events.insertInTransaction(tx, {
      aggregateType: "shop_order",
      aggregateId: order.id,
      eventType: "shop.order.paid",
      producer: "shop-api",
      payload: {
        schemaVersion: 1,
        orderId: order.id,
        identitySubjectId: order.identitySubjectId,
        totalPence: order.totalPence,
        paidAt: input.paidAt.toISOString(),
        lineCount: lines.length,
      },
    });

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

      const receiptLines = lineDetails.filter(
        (line): line is typeof line & { editionNumber: number } => line.editionNumber !== null,
      );

      const [vatRow] = await tx
        .select({
          vatAmountPence: sql<number>`coalesce(sum(${shopOrderLine.vatPence}), 0)::int`,
        })
        .from(shopOrderLine)
        .where(eq(shopOrderLine.orderId, order.id));

      await options.notifications.queueOrderReceipt(tx, {
        idempotencyKey: `order-receipt:${order.id}`,
        identitySubjectId: order.identitySubjectId,
        fallbackEmail: options.fallbackCustomerEmail ?? null,
        orderId: order.id,
        totalPence: order.totalPence,
        vatAmountPence: vatRow?.vatAmountPence ?? 0,
        storefrontUrl: options.storefrontUrl,
        lines: receiptLines.map((line) => ({
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

const REAPER_ASYNC_PAYMENT_BACKOFF_MS = 15 * 60 * 1000;

export type ShopCheckoutExpireOutcome = "expired" | "duplicate" | "unchanged" | "deferred_async";

async function deferCheckoutReaperForAsyncPayment(db: Database, orderId: string): Promise<void> {
  await db
    .update(shopOrder)
    .set({
      checkoutExpiresAt: new Date(Date.now() + REAPER_ASYNC_PAYMENT_BACKOFF_MS),
      updatedAt: new Date(),
    })
    .where(and(eq(shopOrder.id, orderId), eq(shopOrder.status, "pending_payment")));
}

export async function recordShopCheckoutCurrencyViolation(
  db: Database,
  input: { eventId: string; orderId: string; currency: string; sessionId: string },
  options: CheckoutTransitionOptions = {},
): Promise<"processed" | "duplicate"> {
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
  return db.transaction(async (tx) => {
    const [claim] = await tx
      .insert(shopProcessedPaymentEvent)
      .values({ eventId: input.eventId, source: "stripe-currency-violation" })
      .onConflictDoNothing()
      .returning({ eventId: shopProcessedPaymentEvent.eventId });
    if (!claim) return "duplicate";
    await queueCheckoutOpsAlertInTx(tx as Database, options, {
      idempotencyKey: `currency-violation:${input.eventId}`,
      alertKind: "Non-GBP checkout payment",
      orderId: input.orderId,
      detail: `Stripe session ${input.sessionId} settled in ${input.currency.toUpperCase()} instead of GBP.`,
    });
    const locked = await tx
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, input.orderId))
      .for("update")
      .limit(1);
    const order = locked[0];
    if (order?.status === "pending_payment") {
      await tx
        .update(shopOrder)
        .set({ status: "payment_failed", updatedAt: new Date() })
        .where(eq(shopOrder.id, input.orderId));
      await releaseReservedEditionsForOrder(tx as Database, input.orderId, events);
      await restoreBasketLinesFromOrder(tx as Database, order, input.orderId);
    }
    return "processed";
  });
}

export async function cancelShopCheckoutSession(
  db: Database,
  input: { eventId: string; orderId: string; source?: string },
  options: CheckoutTransitionOptions = {},
): Promise<"processed" | "duplicate"> {
  const source = input.source ?? "buyer";
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
  await expireStripeBeforeLocalTransition(
    db,
    input.orderId,
    options.paymentGateway,
    "buyer_cancel",
  );
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
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(shopOrder.id, input.orderId));
    await releaseReservedEditionsForOrder(tx as Database, input.orderId, events);
    await restoreBasketLinesFromOrder(tx as Database, order, input.orderId);
    return "processed";
  });
}

export async function expireShopCheckoutSession(
  db: Database,
  input: { eventId: string; orderId: string; source?: string; sessionId?: string },
  options: CheckoutTransitionOptions = {},
): Promise<ShopCheckoutExpireOutcome> {
  const source = input.source ?? "stripe";
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
  const stripeGate = await expireStripeBeforeLocalTransition(
    db,
    input.orderId,
    options.paymentGateway,
    "expire",
  );
  if (stripeGate === "skip_async") {
    await deferCheckoutReaperForAsyncPayment(db, input.orderId);
    return "deferred_async";
  }
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
      return "unchanged";
    }
    if (input.sessionId) {
      assertStripeSessionMatchesOrder(order, input.sessionId);
    }
    await tx
      .update(shopOrder)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(shopOrder.id, input.orderId));
    await releaseReservedEditionsForOrder(tx as Database, input.orderId, events);
    await restoreBasketLinesFromOrder(tx as Database, order, input.orderId);
    return "expired";
  });
}

export async function failShopCheckoutSession(
  db: Database,
  input: { eventId: string; orderId: string; source?: string; sessionId?: string },
  options: CheckoutTransitionOptions = {},
): Promise<"processed" | "duplicate"> {
  const source = input.source ?? "stripe";
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
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
    if (input.sessionId) {
      assertStripeSessionMatchesOrder(order, input.sessionId);
    }
    await tx
      .update(shopOrder)
      .set({ status: "payment_failed", updatedAt: new Date() })
      .where(eq(shopOrder.id, input.orderId));
    await releaseReservedEditionsForOrder(tx as Database, input.orderId, events);
    await restoreBasketLinesFromOrder(tx as Database, order, input.orderId);
    return "processed";
  });
}
