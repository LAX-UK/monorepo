import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopFramingTask,
  shopFulfilment,
  shopOrder,
  shopOrderLine,
  shopParty,
  shopPayoutLedger,
  shopProcessedPaymentEvent,
  shopProduct,
  shopProductVariant,
} from "@auction/db/schema";
import {
  computePayoutDueAt,
  framingDueAt,
  isGuestOrderSubject,
  orderVatBreakdown,
  parseFramingOrderSnapshot,
} from "@auction/shop-domain";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { describeReceiptEdition } from "../application/order-line-edition.js";
import { printThenFrame } from "../application/order-line-order.js";
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
  holdMustHaveEndedBy?: Date,
): Promise<"proceed" | "skip_async" | "reconciled" | "unconfirmed" | "hold_running"> {
  if (!paymentGateway) {
    return "proceed";
  }
  const [preview] = await db
    .select({
      status: shopOrder.status,
      stripeCheckoutSessionId: shopOrder.stripeCheckoutSessionId,
      checkoutExpiresAt: shopOrder.checkoutExpiresAt,
    })
    .from(shopOrder)
    .where(eq(shopOrder.id, orderId))
    .limit(1);
  if (!preview || preview.status !== "pending_payment") {
    return "proceed";
  }
  // The session ended below is the one read here, so the hold is judged on this same read: a buyer
  // who opened payment since the sweep chose the order has a new session that must not be ended.
  if (holdMustHaveEndedBy && holdStillRunning(preview, holdMustHaveEndedBy)) {
    return "hold_running";
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
  await applyPaidSession(db, orderId, sessionId, paid, options);
  return "reconciled";
}

type PaidSession = NonNullable<Awaited<ReturnType<PaymentCheckoutGateway["retrievePaidCheckout"]>>>;

/** Puts a paid session read from Stripe through the same path as its payment event. */
async function applyPaidSession(
  db: Database,
  orderId: string,
  sessionId: string,
  paid: PaidSession,
  options: CheckoutTransitionOptions,
): Promise<void> {
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
}

const SHOP_CHECKOUT_CEILING_SOURCE = "shop-api-reaper-ceiling";

/**
 * An order that has had all the hold there is must not be left in the sweep. Stripe is asked once
 * more: a paid session is applied (or recorded) like its event; one that is not paid, or that
 * Stripe has shown paid but cannot be read, is not guessed at. If Stripe showed it paid, or could
 * not be read at all, the order is closed and finance gets a task to check the payment in Stripe;
 * otherwise it is expired as any unpaid order is.
 */
async function settleOrderPastCeiling(
  db: Database,
  orderId: string,
  options: CheckoutTransitionOptions,
  stripeShowsPaid: boolean,
): Promise<"reconciled" | "expired" | "closed_unconfirmed" | "not_pending"> {
  const [order] = await db
    .select({ status: shopOrder.status, sessionId: shopOrder.stripeCheckoutSessionId })
    .from(shopOrder)
    .where(eq(shopOrder.id, orderId))
    .limit(1);
  if (!order || order.status !== "pending_payment") return "not_pending";
  let readable = true;
  let paid: PaidSession | null = null;
  if (options.paymentGateway && order.sessionId) {
    try {
      paid = await options.paymentGateway.retrievePaidCheckout({
        orderId,
        sessionId: order.sessionId,
      });
    } catch {
      readable = false;
    }
  }
  if (paid && order.sessionId) {
    await applyPaidSession(db, orderId, order.sessionId, paid, options);
    return "reconciled";
  }
  if (order.sessionId && (stripeShowsPaid || !readable)) {
    await closeOrderPaidNotConfirmed(db, orderId, order.sessionId, options);
    return "closed_unconfirmed";
  }
  await expireShopCheckoutSession(
    db,
    {
      eventId: `reaper-ceiling:${orderId}`,
      orderId,
      source: SHOP_CHECKOUT_CEILING_SOURCE,
      skipStripe: true,
    },
    options,
  );
  return "expired";
}

/** Closes an order Stripe shows paid but that could not be confirmed, with a finance task. */
async function closeOrderPaidNotConfirmed(
  db: Database,
  orderId: string,
  sessionId: string,
  options: CheckoutTransitionOptions,
): Promise<void> {
  const events = createShopDomainEventPublisher(options.domainEventMode ?? "off");
  await db.transaction(async (tx) => {
    const database = tx as Database;
    const [order] = await database
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.id, orderId))
      .for("update")
      .limit(1);
    if (!order || order.status !== "pending_payment") return;
    const eventId = `reaper-unconfirmed:${sessionId}`;
    if (!(await claimPaymentEvent(database, eventId))) return;
    await closeOrderForUnappliedPayment(database, order, sessionId, events);
    await recordPaymentForFinance(
      database,
      events,
      options,
      {
        eventId,
        orderId,
        sessionId,
        // What Stripe took could not be read, so the order's total stands in for it.
        amountTotalPence: order.totalPence,
        paidAt: new Date(),
      },
      {
        reason: "shop_order_paid_not_confirmed",
        order: { id: order.id, reference: order.reference, status: "payment_failed" },
        orderClosed: true,
      },
    );
  });
}

export type DeferOrSettleOutcome =
  | "deferred"
  | "not_pending"
  | "reconciled"
  | "expired"
  | "closed_unconfirmed"
  | "settle_failed";

/** The name of the log line written when an order past the ceiling could not be settled. */
export const SHOP_CHECKOUT_SETTLE_FAILED = "shop_checkout_settle_failed";

/**
 * Takes an order out of the sweep when settling it failed, and tells ops once. Its hold is cleared
 * (the sweep only reads orders with one), so a settle that keeps failing can never jam the batch;
 * the order is left as it is, with its prints reserved, for engineering to deal with.
 */
async function takeOrderOutOfSweep(
  db: Database,
  orderId: string,
  options: CheckoutTransitionOptions,
  error: unknown,
): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  // Always logged, so log alerting sees it even when no ops email is configured. No personal data.
  const sessionId = await db
    .select({ sessionId: shopOrder.stripeCheckoutSessionId })
    .from(shopOrder)
    .where(eq(shopOrder.id, orderId))
    .limit(1)
    .then((rows) => rows[0]?.sessionId ?? null)
    .catch(() => null);
  console.error(JSON.stringify({ msg: SHOP_CHECKOUT_SETTLE_FAILED, orderId, sessionId, reason }));
  await db.transaction(async (tx) => {
    await tx
      .update(shopOrder)
      .set({ checkoutExpiresAt: null, updatedAt: new Date() })
      .where(and(eq(shopOrder.id, orderId), eq(shopOrder.status, "pending_payment")));
    await queueCheckoutOpsAlertInTx(tx as Database, options, {
      idempotencyKey: `checkout-settle-failed:${orderId}`,
      alertKind: "Shop checkout could not be settled",
      orderId,
      detail: `Order ${orderId} is past the longest hold and could not be settled (${reason}). Check the payment in Stripe and tell engineering; the order is held out of the clean-up so its prints stay reserved.`,
    });
  });
}

/**
 * Leaves an order alone for a while (see {@link deferCheckoutHold}), telling ops once when the
 * same order has been left alone {@link DEFERRALS_BEFORE_OPS_ALERT} times. At the ceiling it is
 * not left alone again: it is settled (see {@link settleOrderPastCeiling}), so no order stays in
 * the sweep for ever.
 */
export async function deferOrSettleCheckout(
  db: Database,
  orderId: string,
  now: Date,
  options: CheckoutTransitionOptions,
  why: { reason: string; stripeShowsPaid: boolean },
): Promise<DeferOrSettleOutcome> {
  const deferral: HoldDeferral = await deferCheckoutHold(db, orderId, now);
  if (deferral.kind === "not_pending") return "not_pending";
  if (deferral.kind === "at_cap") {
    try {
      return await settleOrderPastCeiling(db, orderId, options, why.stripeShowsPaid);
    } catch (error) {
      await takeOrderOutOfSweep(db, orderId, options, error);
      return "settle_failed";
    }
  }
  if (deferral.deferrals === DEFERRALS_BEFORE_OPS_ALERT) {
    await db.transaction((tx) =>
      queueCheckoutOpsAlertInTx(tx as Database, options, {
        idempotencyKey: `checkout-deferred:${orderId}`,
        alertKind: "Shop checkout held open",
        orderId,
        detail: `Order ${orderId} has been left open ${deferral.deferrals} times by the checkout sweep (${why.reason}). Check its payment in Stripe.`,
      }),
    );
  }
  return "deferred";
}

function expireOutcomeOf(outcome: DeferOrSettleOutcome): ShopCheckoutExpireOutcome {
  switch (outcome) {
    case "deferred":
      return "deferred_async";
    case "not_pending":
    case "settle_failed":
      return "unchanged";
    case "reconciled":
      return "reconciled";
    default:
      return "expired";
  }
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
  sessionId: string,
  events: ReturnType<typeof createShopDomainEventPublisher>,
): Promise<void> {
  await tx
    .update(shopOrder)
    .set({
      status: "payment_failed",
      // The session that paid it, so the payment is recognised whichever way it is found next.
      stripeCheckoutSessionId: order.stripeCheckoutSessionId ?? sessionId,
      updatedAt: new Date(),
    })
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
    if (orderClosed) await closeOrderForUnappliedPayment(database, order, input.sessionId, events);
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

/**
 * Marks a Stripe event as handled; false when it already was, so a replay does nothing.
 *
 * Always called first in the transaction that records the event's effects. A second delivery of
 * the same event waits on the first one's uncommitted claim: it gets "already handled" only once
 * the first has committed, and if the first rolls back it takes the claim and does the work
 * itself. Never call this outside that transaction, or a duplicate could be acknowledged for work
 * that was never stored.
 */
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
    await queueFramingTasks(tx as Database, lines, input.paidAt);

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
        // The works and products only: a frame is not another work, and this count names the deal.
        lineCount: lines.filter((line) => line.kind === "goods").length,
        framingLineCount: lines.filter((line) => line.kind === "framing").length,
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
          kind: shopOrderLine.kind,
          framingSnapshot: shopOrderLine.framingSnapshot,
          lineId: shopOrderLine.id,
          framingForLineId: shopOrderLine.framingForLineId,
          createdAt: shopOrderLine.createdAt,
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

      const receiptLines = printThenFrame(lineDetails, (line) => ({
        id: line.lineId,
        createdAt: line.createdAt,
        framingForLineId: line.framingForLineId,
      })).map((line) =>
        line.kind === "framing"
          ? {
              // A frame is told as its own line, by the name it was sold under.
              artworkTitle: `Framing: ${parseFramingOrderSnapshot(line.framingSnapshot).name}`,
              artworkSlug: "",
              editionDetail: null,
              unitPricePence: line.unitPricePence,
            }
          : {
              artworkTitle: line.productVariantId
                ? (line.productTitle ?? "Merchandise")
                : (line.artworkTitle ?? "Artwork"),
              artworkSlug: line.productVariantId
                ? (line.productSlug ?? "")
                : (line.artworkSlug ?? ""),
              // The order is paid and holds its prints, so the number is the buyer's to be told.
              editionDetail: describeReceiptEdition({
                snapshot: line.editionSnapshot,
                live: undefined,
                holdsPrint: true,
                editionNumber: line.editionNumber,
                proofNumber: line.proofNumber,
              }),
              unitPricePence: line.unitPricePence,
            },
      );

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

/**
 * Opens the work on each frame the order sold: one task per framing line, due after the option's
 * longest lead time (from the snapshot taken at checkout) counted from payment.
 */
async function queueFramingTasks(
  tx: Database,
  lines: ReadonlyArray<typeof shopOrderLine.$inferSelect>,
  paidAt: Date,
): Promise<void> {
  const frames = lines.filter((line) => line.kind === "framing");
  if (frames.length === 0) return;
  await tx.insert(shopFramingTask).values(
    frames.map((line) => ({
      orderLineId: line.id,
      // A frame with no readable snapshot fails the payment event loudly (and it is retried)
      // rather than being given a due date of today.
      dueAt: framingDueAt(paidAt, parseFramingOrderSnapshot(line.framingSnapshot)),
    })),
  );
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
    /** Do not ask Stripe: it has been asked already (the order is being settled past its ceiling). */
    skipStripe?: boolean;
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
    input.skipStripe ? undefined : options.paymentGateway,
    "expire",
    options,
    input.holdMustHaveEndedBy,
  );
  if (stripeGate === "hold_running") return "unchanged";
  if (stripeGate === "reconciled") return "reconciled";
  if (stripeGate === "unconfirmed") {
    return expireOutcomeOf(
      await deferOrSettleCheckout(db, input.orderId, new Date(), options, {
        reason: "Stripe shows its session paid but the payment could not be read",
        stripeShowsPaid: true,
      }),
    );
  }
  if (stripeGate === "skip_async") {
    // The debit is still being confirmed: wait, up to the ceiling. Past it the order is settled
    // like any other: a payment that landed is applied, otherwise it expires, and one that lands
    // later is recorded for finance as money for a closed order.
    return expireOutcomeOf(
      await deferOrSettleCheckout(db, input.orderId, new Date(), options, {
        reason: "its payment is still being confirmed",
        stripeShowsPaid: false,
      }),
    );
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
