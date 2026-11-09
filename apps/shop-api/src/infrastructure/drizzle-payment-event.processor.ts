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
  shopProduct,
  shopProductVariant,
} from "@auction/db/schema";
import { computePayoutDueAt, isGuestOrderSubject, orderVatBreakdown } from "@auction/shop-domain";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { describeReceiptEdition } from "../application/order-line-edition.js";
import type { BasketOwner, PaymentCheckoutGateway } from "../application/ports/commerce.ports.js";
import type {
  CompleteCheckoutOutcome,
  PaymentEventProcessor,
} from "../application/ports/payment-event.processor.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import {
  ShopPaymentWebhookError,
  type UnappliedPaymentFailure,
  isUnappliedPaymentFailure,
} from "../errors/shop-payment-webhook.error.js";
import { liveEditionSnapshots } from "./edition-snapshot-source.js";
import { recordGuestOrderPaid } from "./guest-checkout/guest-lead-events.js";
import { guestOrderLinkUrl, issueGuestOrderLink } from "./guest-checkout/guest-order-link-token.js";
import {
  DEFERRALS_BEFORE_OPS_ALERT,
  type HoldDeferral,
  deferCheckoutHold,
} from "./shop-checkout-hold.js";
import {
  assertCheckoutNotAlreadyPaid,
  assertCheckoutNotAsyncPending,
  expireHostedCheckoutSession,
  isAsyncCheckoutPaymentPending,
} from "./shop-checkout-stripe-expiry.js";
import { closeDeliveryQuoteForOrder } from "./shop-delivery-quote-close.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "./shop-domain-event-publisher.js";
import { resolveListingStatusAfterReservationRelease } from "./shop-edition-listing-on-release.js";
import { findOrCreateBuyerParty } from "./shop-party.js";
import { judgePayment } from "./shop-payment-verdict.js";
import { restoreBasketLinesFromOrder } from "./shop-restore-basket-from-order.js";
import {
  SHOP_PAYMENT_FAILURE_REASONS,
  type ShopUnappliedReason,
  type UnappliedMoneyLookup,
  closesOrder,
  recordUnappliedShopPayment,
} from "./shop-unapplied-payment.js";

export type CheckoutTransitionOptions = {
  notifications?: ShopNotificationPublisher;
  opsAlertEmail?: string | null;
  storefrontUrl?: string;
  fallbackCustomerEmail?: string | null;
  paymentGateway?: PaymentCheckoutGateway;
  domainEventMode?: ShopDomainEventPublisherMode;
  /**
   * The finance task store, for money that arrives for an order already closed. Without it that
   * money cannot be recorded, so the webhook fails and Stripe sends it again: it is never dropped.
   */
  unappliedMoney?: UnappliedMoneyLookup;
};

/**
 * Keeps what each buyer was told about their print: the run and confirmed facts at the moment of
 * payment. Later corrections to the facts do not change an order already paid.
 */
async function keepEditionSnapshots(
  tx: Database,
  lines: ReadonlyArray<{ id: string; artworkId: string | null }>,
): Promise<void> {
  const artworkIds = lines.flatMap((line) => (line.artworkId ? [line.artworkId] : []));
  const snapshots = await liveEditionSnapshots(tx, artworkIds);
  for (const line of lines) {
    const snapshot = line.artworkId ? snapshots.get(line.artworkId) : undefined;
    if (!snapshot) continue;
    await tx
      .update(shopOrderLine)
      .set({ editionFactsSnapshot: snapshot })
      .where(eq(shopOrderLine.id, line.id));
  }
}

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
  options: CheckoutTransitionOptions = {},
): Promise<"proceed" | "skip_async" | "reconciled" | "unconfirmed"> {
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
  if (mode === "expire" && outcome.kind === "already_complete") {
    return reconcileCompletedSession(
      db,
      orderId,
      preview.stripeCheckoutSessionId,
      paymentGateway,
      options,
    );
  }
  assertCheckoutNotAlreadyPaid(outcome);
  return "proceed";
}

/**
 * Stripe says the order's session is paid but the order is still waiting, so the payment event
 * did not reach us. The session is read from Stripe and put through the same path as the event:
 * applied if it is paid and matches the order, otherwise recorded as a finance task. Deferring
 * and hoping would leave paid money unrecorded.
 */
async function reconcileCompletedSession(
  db: Database,
  orderId: string,
  sessionId: string | null,
  paymentGateway: PaymentCheckoutGateway,
  options: CheckoutTransitionOptions,
): Promise<"reconciled" | "unconfirmed"> {
  if (!sessionId) return "unconfirmed";
  const paid = await paymentGateway.retrievePaidCheckout({ orderId, sessionId });
  if (!paid) return "unconfirmed";
  await completeShopCheckoutSession(
    db,
    {
      eventId: `reaper-reconcile:${sessionId}`,
      orderId,
      sessionId,
      amountTotalPence: paid.amountTotalPence,
      paidAt: paid.paidAt,
      paymentIntentId: paid.paymentIntentId,
      livemode: paid.livemode,
    },
    options,
  );
  return "reconciled";
}

/**
 * Leaves an order alone for a while (see {@link deferCheckoutHold}) and tells ops, once, when the
 * same order has been left alone {@link DEFERRALS_BEFORE_OPS_ALERT} times.
 */
export async function deferCheckoutWithAlert(
  db: Database,
  orderId: string,
  now: Date,
  options: CheckoutTransitionOptions,
  why: string,
): Promise<HoldDeferral> {
  const deferral = await deferCheckoutHold(db, orderId, now);
  if (deferral.kind === "deferred" && deferral.deferrals === DEFERRALS_BEFORE_OPS_ALERT) {
    await db.transaction((tx) =>
      queueCheckoutOpsAlertInTx(tx as Database, options, {
        idempotencyKey: `checkout-deferred:${orderId}`,
        alertKind: "Shop checkout held open",
        orderId,
        detail: `Order ${orderId} has been left open ${deferral.deferrals} times by the checkout sweep (${why}). Check its payment in Stripe.`,
      }),
    );
  }
  return deferral;
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

async function releaseReservedVariantsForOrder(tx: Database, orderId: string): Promise<void> {
  const releasedAt = new Date();
  const lines = await tx
    .select({
      productVariantId: shopOrderLine.productVariantId,
      releasedAt: shopOrderLine.releasedAt,
    })
    .from(shopOrderLine)
    .where(and(eq(shopOrderLine.orderId, orderId), isNull(shopOrderLine.releasedAt)));
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (!line.productVariantId) {
      continue;
    }
    counts.set(line.productVariantId, (counts.get(line.productVariantId) ?? 0) + 1);
  }
  for (const [variantId, count] of counts) {
    await tx
      .update(shopProductVariant)
      .set({
        reserved: sql`${shopProductVariant.reserved} - ${count}`,
        updatedAt: new Date(),
      })
      .where(eq(shopProductVariant.id, variantId));
  }
  if (counts.size > 0) {
    await tx
      .update(shopOrderLine)
      .set({ releasedAt })
      .where(
        and(
          eq(shopOrderLine.orderId, orderId),
          isNull(shopOrderLine.releasedAt),
          isNotNull(shopOrderLine.productVariantId),
        ),
      );
  }
}

async function finalizePaidVariantStockForOrder(tx: Database, orderId: string): Promise<void> {
  const lines = await tx
    .select({ productVariantId: shopOrderLine.productVariantId })
    .from(shopOrderLine)
    .where(eq(shopOrderLine.orderId, orderId));
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (!line.productVariantId) {
      continue;
    }
    counts.set(line.productVariantId, (counts.get(line.productVariantId) ?? 0) + 1);
  }
  for (const [variantId, count] of counts) {
    await tx
      .update(shopProductVariant)
      .set({
        onHand: sql`${shopProductVariant.onHand} - ${count}`,
        reserved: sql`${shopProductVariant.reserved} - ${count}`,
        updatedAt: new Date(),
      })
      .where(eq(shopProductVariant.id, variantId));
  }
}

async function releaseReservedEditionsForOrder(
  tx: Database,
  orderId: string,
  events: ReturnType<typeof createShopDomainEventPublisher>,
): Promise<void> {
  await releaseReservedVariantsForOrder(tx, orderId);
  const lines = await tx.select().from(shopOrderLine).where(eq(shopOrderLine.orderId, orderId));
  const editionLines = lines.filter(
    (line): line is typeof line & { editionId: string } => line.editionId !== null,
  );
  const editionIds = editionLines.map((line) => line.editionId);
  const releasedAt = new Date();
  if (editionIds.length === 0) {
    return;
  }
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

type PaidEvent = {
  eventId: string;
  orderId: string;
  sessionId: string;
  amountTotalPence: number;
  paidAt: Date;
  customerEmail?: string | null;
  paymentIntentId?: string | null;
  /** Whether Stripe sent it from live mode; only live money for an unknown order is recorded. */
  livemode?: boolean;
};

/**
 * Applies a paid Stripe Checkout Session to its order, or keeps the money from being lost.
 *
 * A payment that cannot be applied and that Stripe cannot cure by sending it again (the amount
 * is not the order's, the session is not the order's, the print is no longer held for it, the
 * order was already paid in another session, or it was closed) used to answer 400, and Stripe
 * gave up after a few days with no one told. Now the failed attempt is rolled back whole, and the
 * money is recorded as a finance task in its own transaction, which also closes an order that
 * can no longer be paid. Stripe is answered only once that is stored: if recording fails the
 * webhook fails and is sent again.
 */
export async function completeShopCheckoutSession(
  db: Database,
  input: PaidEvent,
  options: CheckoutTransitionOptions = {},
): Promise<CompleteCheckoutOutcome> {
  try {
    return await applyShopPayment(db, input, options);
  } catch (error) {
    if (!(error instanceof ShopPaymentWebhookError) || error.retryable) throw error;
    if (isUnappliedPaymentFailure(error.code)) {
      return recordUnappliedPayment(db, input, options, error.code);
    }
    if (error.code === "payment_not_found") {
      return recordPaymentForUnknownOrder(db, input, options, error);
    }
    throw error;
  }
}

type PaymentRecord = {
  reason: ShopUnappliedReason;
  /** The order the money was paid for; null when none exists here. */
  order: { id: string; reference: string | null; status: string } | null;
  /** The order was closed by this payment, so its prints are free and its basket is back. */
  orderClosed: boolean;
};

/**
 * Records the money that could not be applied: the finance task, and an ops alert as an extra.
 * The one place both are made, so every reason reads the same way to finance and to ops.
 */
async function recordPaymentForFinance(
  tx: Database,
  events: ReturnType<typeof createShopDomainEventPublisher>,
  options: CheckoutTransitionOptions,
  input: PaidEvent,
  record: PaymentRecord,
): Promise<void> {
  const unappliedMoney = options.unappliedMoney;
  if (!unappliedMoney) throw new Error("unapplied_money_reader_not_configured");
  await recordUnappliedShopPayment(tx, events, unappliedMoney, {
    reason: record.reason,
    order: record.order,
    sessionId: input.sessionId,
    paymentIntentId: input.paymentIntentId ?? null,
    amountPence: input.amountTotalPence,
    eventId: input.eventId,
  });
  await queueCheckoutOpsAlertInTx(tx, options, {
    ...unappliedPaymentAlert(input, record),
    orderId: input.orderId,
  });
}

function unappliedPaymentAlert(
  input: PaidEvent,
  record: PaymentRecord,
): { idempotencyKey: string; alertKind: string; detail: string } {
  const paid = `Stripe session ${input.sessionId} paid ${input.amountTotalPence} pence`;
  if (record.reason === "shop_order_paid_after_close") {
    return {
      idempotencyKey: `terminal-paid:${input.eventId}`,
      alertKind: "Paid webhook for terminal order",
      detail: `${paid} while order status is ${record.order?.status}. Manual refund review may be required.`,
    };
  }
  if (record.reason === "shop_order_not_found") {
    return {
      idempotencyKey: `unapplied-payment:${input.eventId}`,
      alertKind: "Shop payment for an unknown order",
      detail: `${paid} for order ${input.orderId}, which does not exist. Finance has a task.`,
    };
  }
  return {
    idempotencyKey: `unapplied-payment:${input.eventId}`,
    alertKind: "Shop payment that could not be applied",
    detail: `${paid}, which could not be applied to the order (${record.reason}). ${
      record.orderClosed
        ? "The order was closed, its prints released and its basket restored."
        : "Nothing was changed."
    } Finance has a task.`,
  };
}

/** Ends an order that can no longer be paid: its own session is spent, so nothing would ever close it. */
async function closeOrderForUnappliedPayment(
  tx: Database,
  order: typeof shopOrder.$inferSelect,
  events: ReturnType<typeof createShopDomainEventPublisher>,
): Promise<void> {
  await tx
    .update(shopOrder)
    .set({ status: "payment_failed", updatedAt: new Date() })
    .where(eq(shopOrder.id, order.id));
  await closeDeliveryQuoteForOrder(tx, order.id, "expired");
  await releaseReservedEditionsForOrder(tx, order.id, events);
  await restoreBasketLinesFromOrder(tx, order, order.id);
}

/**
 * Records the money of a payment that could not be applied, in its own transaction. The order is
 * read again under its lock, so the reason is the order's state now and not what it was when the
 * first attempt failed.
 */
async function recordUnappliedPayment(
  db: Database,
  input: PaidEvent,
  options: CheckoutTransitionOptions,
  attempted: UnappliedPaymentFailure,
): Promise<CompleteCheckoutOutcome> {
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
  return db.transaction(async (tx) => {
    const database = tx as Database;
    if (!(await claimPaymentEvent(database, input.eventId))) return "duplicate";
    const [order] = await database
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, input.orderId))
      .for("update")
      .limit(1);
    if (!order) throw new ShopPaymentWebhookError("payment_not_found", { retryable: false });
    const verdict = judgePayment(order, input);
    if (verdict.kind === "already_applied") return "processed";
    // A print that was no longer held is found only by applying the payment: keep that finding.
    // Any other failure that no longer holds means the order changed under us: apply it again.
    if (verdict.kind === "apply" && attempted !== "edition_state_invalid") {
      throw new ShopPaymentWebhookError("payment_state_changed", { retryable: true });
    }
    const failure = verdict.kind === "unapplied" ? verdict.failure : attempted;
    const orderClosed = closesOrder(failure) && order.status === "pending_payment";
    if (orderClosed) await closeOrderForUnappliedPayment(database, order, events);
    await recordPaymentForFinance(database, events, options, input, {
      reason: SHOP_PAYMENT_FAILURE_REASONS[failure],
      order: { id: order.id, reference: order.reference, status: order.status },
      orderClosed,
    });
    return failure === "paid_after_close" ? "terminal_acknowledged" : "unapplied_recorded";
  });
}

/**
 * A payment for an order that does not exist here. In live mode it is real money and becomes a
 * finance task with no order. In test mode it is a stray event: it is logged and ops are told,
 * and the webhook still answers 400.
 */
async function recordPaymentForUnknownOrder(
  db: Database,
  input: PaidEvent,
  options: CheckoutTransitionOptions,
  notFound: ShopPaymentWebhookError,
): Promise<CompleteCheckoutOutcome> {
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
  if (!input.livemode) {
    console.error(
      JSON.stringify({
        msg: "shop_payment_unknown_order_test_mode",
        orderId: input.orderId,
        sessionId: input.sessionId,
        paymentIntentId: input.paymentIntentId ?? null,
        amountPence: input.amountTotalPence,
      }),
    );
    await db.transaction((tx) =>
      queueCheckoutOpsAlertInTx(tx as Database, options, {
        idempotencyKey: `unknown-order-test:${input.eventId}`,
        alertKind: "Test-mode payment for an unknown order",
        orderId: input.orderId,
        detail: `Stripe session ${input.sessionId} was paid in test mode for order ${input.orderId}, which does not exist.`,
      }),
    );
    throw notFound;
  }
  return db.transaction(async (tx) => {
    if (!(await claimPaymentEvent(tx as Database, input.eventId))) return "duplicate";
    await recordPaymentForFinance(tx as Database, events, options, input, {
      reason: "shop_order_not_found",
      order: null,
      orderClosed: false,
    });
    return "unapplied_recorded";
  });
}

/** Marks a Stripe event as handled; false when it already was, so a replay does nothing. */
async function claimPaymentEvent(tx: Database, eventId: string): Promise<boolean> {
  const [claim] = await tx
    .insert(shopProcessedPaymentEvent)
    .values({ eventId, source: "stripe" })
    .onConflictDoNothing()
    .returning({ eventId: shopProcessedPaymentEvent.eventId });
  return Boolean(claim);
}

async function applyShopPayment(
  db: Database,
  input: PaidEvent,
  options: CheckoutTransitionOptions,
): Promise<CompleteCheckoutOutcome> {
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
  return db.transaction(async (tx) => {
    if (!(await claimPaymentEvent(tx as Database, input.eventId))) return "duplicate";

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
    const verdict = judgePayment(order, input);
    if (verdict.kind === "already_applied") return "processed";
    if (verdict.kind === "unapplied") {
      throw new ShopPaymentWebhookError(verdict.failure, { retryable: false });
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
        // The session that paid it, so another event for the same payment is recognised later.
        stripeCheckoutSessionId: input.sessionId,
        buyerPartyId,
        refundPeriodEndsAt: null,
        updatedAt: new Date(),
      })
      .where(eq(shopOrder.id, order.id));

    const lines = await tx.select().from(shopOrderLine).where(eq(shopOrderLine.orderId, order.id));
    const editionLines = lines.filter(
      (line): line is typeof line & { editionId: string; sellerPartyId: string } =>
        line.editionId !== null && line.sellerPartyId !== null,
    );
    const initialFulfilmentStatus =
      editionLines.length > 0 ? "pending_production" : "awaiting_dispatch";

    await tx
      .insert(shopFulfilment)
      .values({
        orderId: order.id,
        option: order.fulfilment,
        status: initialFulfilmentStatus,
      })
      .onConflictDoNothing({ target: shopFulfilment.orderId });

    await finalizePaidVariantStockForOrder(tx as Database, order.id);
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

    await keepEditionSnapshots(tx as Database, editionLines);

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

    if (order.guestCustomerId) {
      await recordGuestOrderPaid(
        tx as Database,
        { guestCustomerId: order.guestCustomerId, paidAt: input.paidAt },
        options.domainEventMode ?? "off",
      );
    }

    if (options.notifications && options.storefrontUrl) {
      // A guest has no account to open the order from, so the receipt carries a link that does.
      const guestOrderUrl = isGuestOrderSubject(order.identitySubjectId)
        ? guestOrderLinkUrl(
            options.storefrontUrl,
            (await issueGuestOrderLink(tx as Database, order.id, new Date())).token,
          )
        : undefined;
      const lineDetails = await tx
        .select({
          artworkTitle: shopArtwork.title,
          artworkSlug: shopArtwork.slug,
          productTitle: shopProduct.title,
          productSlug: shopProduct.slug,
          variantSku: shopProductVariant.sku,
          editionNumber: shopOrderLine.editionNumber,
          editionSnapshot: shopOrderLine.editionFactsSnapshot,
          proofNumber: shopEdition.proofNumber,
          productVariantId: shopOrderLine.productVariantId,
          unitPricePence: shopOrderLine.unitPricePence,
          vatRateBp: shopOrderLine.vatRateBp,
          vatPence: shopOrderLine.vatPence,
        })
        .from(shopOrderLine)
        .leftJoin(shopEdition, eq(shopOrderLine.editionId, shopEdition.id))
        .leftJoin(shopArtwork, eq(shopOrderLine.artworkId, shopArtwork.id))
        .leftJoin(shopProductVariant, eq(shopOrderLine.productVariantId, shopProductVariant.id))
        .leftJoin(shopProduct, eq(shopProductVariant.productId, shopProduct.id))
        .where(eq(shopOrderLine.orderId, order.id));
      // The VAT stored with the lines and the delivery charge, as on the order page and invoice.
      const vat = orderVatBreakdown({
        lines: lineDetails.map((line) => ({ vatPence: line.vatPence, vatRateBp: line.vatRateBp })),
        deliveryVatPence: order.fulfilmentVatPence,
        totalPence: order.totalPence,
      });

      const receiptLines = lineDetails.map((line) => ({
        artworkTitle: line.productVariantId
          ? (line.productTitle ?? "Merchandise")
          : (line.artworkTitle ?? "Artwork"),
        artworkSlug: line.productVariantId ? (line.productSlug ?? "") : (line.artworkSlug ?? ""),
        // The order is paid and holds its prints, so the number is the buyer's to be told.
        editionDetail: describeReceiptEdition({
          snapshot: line.editionSnapshot,
          live: undefined,
          holdsPrint: true,
          editionNumber: line.editionNumber,
          proofNumber: line.proofNumber,
        }),
        unitPricePence: line.unitPricePence,
      }));

      await options.notifications.queueOrderReceipt(tx, {
        idempotencyKey: `order-receipt:${order.id}`,
        identitySubjectId: order.identitySubjectId,
        fallbackEmail: options.fallbackCustomerEmail ?? null,
        orderId: order.id,
        orderReference: order.reference,
        totalPence: order.totalPence,
        vatAmountPence: vat ? vat.vatPence : null,
        storefrontUrl: options.storefrontUrl,
        ...(guestOrderUrl ? { guestOrderUrl } : {}),
        lines: receiptLines.map((line) => ({
          artworkTitle: line.artworkTitle,
          artworkSlug: line.artworkSlug,
          editionDetail: line.editionDetail,
          unitPricePence: line.unitPricePence,
        })),
      });
    }

    return "processed";
  });
}

export type ShopCheckoutExpireOutcome =
  | "expired"
  | "duplicate"
  | "unchanged"
  | "deferred_async"
  | "reconciled";

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
  input: { eventId: string; orderId: string; source?: string; restoreTo?: BasketOwner },
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
    await closeDeliveryQuoteForOrder(tx as Database, input.orderId, "cancelled_by_buyer");
    await releaseReservedEditionsForOrder(tx as Database, input.orderId, events);
    await restoreBasketLinesFromOrder(tx as Database, order, input.orderId, input.restoreTo);
    return "processed";
  });
}

/** Whether the order's hold has not ended by `endedBy`, so a sweep must leave it alone. */
function holdStillRunning(
  order: { checkoutExpiresAt: Date | null },
  endedBy: Date | undefined,
): boolean {
  return Boolean(endedBy && order.checkoutExpiresAt && order.checkoutExpiresAt >= endedBy);
}

/**
 * Expires an order whose checkout ended: the buyer let it run out, Stripe said so, or the reaper
 * found its hold past. The reaper passes `holdMustHaveEndedBy` (its sweep time): an order whose
 * hold was stretched after the sweep chose it (a buyer opening payment) is left alone, both
 * before Stripe's session is ended and again under the order's row lock. That check comes before
 * the event is claimed, so an order that was spared is found again by a later sweep.
 */
export async function expireShopCheckoutSession(
  db: Database,
  input: {
    eventId: string;
    orderId: string;
    source?: string;
    sessionId?: string;
    holdMustHaveEndedBy?: Date;
  },
  options: CheckoutTransitionOptions = {},
): Promise<ShopCheckoutExpireOutcome> {
  const source = input.source ?? "stripe";
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
  if (input.holdMustHaveEndedBy) {
    const [current] = await db
      .select({ checkoutExpiresAt: shopOrder.checkoutExpiresAt })
      .from(shopOrder)
      .where(eq(shopOrder.id, input.orderId))
      .limit(1);
    if (current && holdStillRunning(current, input.holdMustHaveEndedBy)) return "unchanged";
  }
  const stripeGate = await expireStripeBeforeLocalTransition(
    db,
    input.orderId,
    options.paymentGateway,
    "expire",
    options,
  );
  if (stripeGate === "reconciled") return "reconciled";
  if (stripeGate === "unconfirmed") {
    const deferral = await deferCheckoutWithAlert(
      db,
      input.orderId,
      new Date(),
      options,
      "Stripe shows its session paid but the payment could not be read",
    );
    return deferral.kind === "deferred" ? "deferred_async" : "unchanged";
  }
  if (stripeGate === "skip_async") {
    // The debit is still being confirmed: wait, up to the ceiling. Past it the payment is treated
    // as not made, and one that lands later is recorded for finance as money for a closed order.
    const deferral = await deferCheckoutWithAlert(
      db,
      input.orderId,
      new Date(),
      options,
      "its payment is still being confirmed",
    );
    if (deferral.kind === "deferred") return "deferred_async";
    if (deferral.kind === "not_pending") return "unchanged";
  }
  return db.transaction(async (tx) => {
    if (input.holdMustHaveEndedBy) {
      const [current] = await tx
        .select({
          status: shopOrder.status,
          checkoutExpiresAt: shopOrder.checkoutExpiresAt,
        })
        .from(shopOrder)
        .where(eq(shopOrder.id, input.orderId))
        .for("update")
        .limit(1);
      // Before the claim, so a spared order's event id is not used up and the next sweep can end it.
      if (
        !current ||
        current.status !== "pending_payment" ||
        holdStillRunning(current, input.holdMustHaveEndedBy)
      ) {
        return "unchanged";
      }
    }
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
    await closeDeliveryQuoteForOrder(tx as Database, input.orderId, "expired");
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
