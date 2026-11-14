import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  domainEvent,
  legalEntity,
  lot,
  payment,
  paymentRefund,
  payout,
  payoutLine,
  processedStripeEvents,
} from "@auction/db/schema";
import { FinanceTaskLatePaymentRecorder } from "@auction/finance-runtime";
import {
  DrizzlePaymentRefundRepository,
  DrizzlePaymentRepository,
  DrizzlePaymentWebhookLookupReader,
  DrizzlePayoutRepository,
  DrizzleUnappliedMoneyReader,
} from "@auction/persistence/repositories";
import { and, eq, inArray, like } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeChargeRefunds } from "../../test/fake-charge-refunds.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { DomainEventSink } from "../domain-event-sink.js";
import { DomainEventPublisher } from "../domain-event.publisher.js";
import { PaymentCaptureService } from "../payment/payment-capture.service.js";
import { UnappliedMoneyRecorder } from "../payment/unapplied-money.recorder.js";
import { PayoutAdjustmentService } from "../payout/payout-adjustment.service.js";
import { StripePaymentWebhookService } from "../stripe-payment-webhook.service.js";
import { UnappliedMoneyRefundHandler } from "./unapplied-money-refund.handler.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Refunds of money that was, or was not, applied to an invoice, end to end through the
 * webhooks: the seller's payout is clawed back only for money that reached them.
 */
describe.skipIf(!HAS_DB)("refunds of unapplied money (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const runner = transactionRunnerFromDb(db);
  const payments = new DrizzlePaymentRepository(db);
  const payouts = new DrizzlePayoutRepository(db);
  const events = new DomainEventSink(new DomainEventPublisher(), db);
  const reader = new DrizzleUnappliedMoneyReader(db);
  const recorder = new UnappliedMoneyRecorder(reader, events);
  const capture = new PaymentCaptureService(
    runner,
    payments,
    { findById: async () => null } as never,
    { findById: async () => null } as never,
    events,
    null,
    {} as never,
    null,
    null,
    null,
    null,
    null,
    recorder,
  );
  const payoutAdjustments = new PayoutAdjustmentService(
    runner,
    payouts,
    (_root, tx) => new DrizzlePayoutRepository(tx),
  );
  const refundRecords = new DrizzlePaymentRefundRepository(db);
  // What Stripe lists as refunded on each charge; every refund here has succeeded.
  const stripeRefunds = new FakeChargeRefunds();
  const webhooks = new StripePaymentWebhookService(
    runner,
    new DrizzlePaymentWebhookLookupReader(db),
    payments,
    payouts,
    payoutAdjustments,
    capture,
    events,
    { record: vi.fn() },
    null,
    null,
    recorder,
    new UnappliedMoneyRefundHandler({
      transactionRunner: runner,
      reader,
      recorder,
      chargeRefunds: stripeRefunds,
    }),
    null,
    refundRecords,
    undefined,
    null,
    stripeRefunds,
  );

  const run = randomUUID().slice(0, 8);
  const buyerId = `um-buyer-${run}`;
  const buyerEntityId = randomUUID();
  const sellerId = randomUUID();
  const lotId = randomUUID();
  let paymentId: string;

  const eventOf = (type: string, object: unknown) =>
    ({ id: `evt_um_${run}_${randomUUID()}`, type, data: { object } }) as unknown as Stripe.Event;
  const money = () => ({ pi: `pi_um_${run}_${randomUUID()}`, ch: `ch_um_${run}_${randomUUID()}` });
  const succeeded = (pi: string, ch: string) =>
    ({
      id: pi,
      amount: 10_000,
      amount_received: 10_000,
      currency: "gbp",
      metadata: { paymentId },
      latest_charge: ch,
    }) as unknown as Stripe.PaymentIntent;
  const refunded = (pi: string, ch: string) =>
    ({
      id: ch,
      amount: 10_000,
      amount_refunded: 10_000,
      currency: "gbp",
      payment_intent: pi,
      metadata: { paymentId },
    }) as unknown as Stripe.Charge;
  const refundLines = () =>
    db
      .select({ amount: payoutLine.amount })
      .from(payoutLine)
      .where(eq(payoutLine.paymentId, paymentId));

  beforeAll(async () => {
    const now = new Date();
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: "Buyer", email: `${buyerId}@integration.test` },
    ]);
    await db.insert(legalEntity).values([
      {
        id: buyerEntityId,
        displayName: "Buyer",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: buyerId,
        status: "approved",
      },
      {
        id: sellerId,
        displayName: "Seller",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: buyerId,
        status: "approved",
      },
    ]);
    await db.insert(lot).values({
      id: lotId,
      title: "Work",
      images: [],
      auctionType: "english",
      startingPrice: "10.00",
      currentPrice: "100.00",
      minBidIncrement: "10.00",
      startTime: new Date(now.getTime() - 3 * 86_400_000),
      endTime: new Date(now.getTime() - 86_400_000),
      status: "ended",
      sellerLegalEntityId: sellerId,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntityId,
    });
  });

  const reset = async (status: "pending" | "cancelled") => {
    const old = (
      await db.select({ id: payment.id }).from(payment).where(eq(payment.lotId, lotId))
    ).map((r) => r.id);
    if (old.length) {
      await db.delete(paymentRefund).where(inArray(paymentRefund.paymentId, old));
      await db.delete(payoutLine).where(inArray(payoutLine.paymentId, old));
      await db.delete(domainEvent).where(inArray(domainEvent.aggregateId, old));
    }
    await db.delete(payment).where(eq(payment.lotId, lotId));
    const [row] = await db
      .insert(payment)
      .values({
        lotId,
        buyerId,
        buyerLegalEntityId: buyerEntityId,
        sellerLegalEntityId: sellerId,
        amount: "100.00",
        platformFee: "5.00",
        status,
      })
      .returning({ id: payment.id });
    paymentId = row?.id as string;
  };

  beforeEach(() => reset("pending"));

  afterAll(async () => {
    await reset("pending");
    await db.delete(domainEvent).where(eq(domainEvent.aggregateId, paymentId));
    await db.delete(payment).where(eq(payment.lotId, lotId));
    await db.delete(payout).where(eq(payout.legalEntityId, sellerId));
    await db.delete(lot).where(eq(lot.id, lotId));
    await db
      .delete(processedStripeEvents)
      .where(like(processedStripeEvents.eventId, `evt_um_${run}_%`));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerEntityId, sellerId]));
    await deleteIdentityUserFixtures(db, [buyerId]);
  });

  it("a paid-not-recorded task closes when the webhook captures it, and a refund before payout charges the seller nothing", async () => {
    const { pi, ch } = money();
    await new FinanceTaskLatePaymentRecorder(recorder, runner).recordPaid({
      paymentId,
      amountPence: 10_000,
      buyerLegalEntityId: buyerEntityId,
      state: { kind: "paid", paymentIntentId: pi, chargeId: ch, amountReceivedPence: 10_000 },
    });
    expect(await reader.listOpen({ paymentIntentId: pi, limit: 5 })).toHaveLength(1);

    await webhooks.handlePaymentIntentSucceeded(
      eventOf("payment_intent.succeeded", succeeded(pi, ch)),
      succeeded(pi, ch),
    );
    expect((await payments.findById(paymentId))?.status).toBe("captured");
    expect(await reader.listOpen({ paymentIntentId: pi, limit: 5 })).toEqual([]);

    stripeRefunds.show(ch, 10_000);

    const result = await webhooks.handleChargeRefunded(
      eventOf("charge.refunded", refunded(pi, ch)),
      refunded(pi, ch),
    );
    expect(result).toMatchObject({ processed: true, action: "refund_received" });
    expect((await payments.findById(paymentId))?.status).toBe("refunded");
    // The sale was never paid out, so nothing is taken back from the seller.
    expect(await refundLines()).toEqual([]);
    expect(await payouts.sumRefundLineCentsForPayment(paymentId)).toBe(10_000);
  });

  it("a captured invoice that recorded only the intent keeps its own refund, even when a task carried that intent", async () => {
    const { pi, ch } = money();
    // A task raised before the payment was recorded, carrying the intent but no charge id.
    await new FinanceTaskLatePaymentRecorder(recorder, runner).recordPaid({
      paymentId,
      amountPence: 10_000,
      buyerLegalEntityId: buyerEntityId,
      state: { kind: "paid", paymentIntentId: pi, chargeId: null, amountReceivedPence: 10_000 },
    });
    // Captured with no charge id (the charge lookup at capture found none).
    const noCharge = { ...succeeded(pi, ch), latest_charge: null } as Stripe.PaymentIntent;
    await webhooks.handlePaymentIntentSucceeded(
      eventOf("payment_intent.succeeded", noCharge),
      noCharge,
    );
    const captured = await payments.findById(paymentId);
    expect(captured?.status).toBe("captured");
    expect(captured?.stripeChargeId ?? null).toBeNull();
    expect(captured?.stripePaymentIntentId).toBe(pi);
    expect(await reader.wasEverUnapplied({ chargeId: ch, paymentIntentId: pi })).toBe(true);
    expect(await reader.isChargeOfPaidInvoice({ chargeId: ch, paymentIntentId: pi })).toBe(true);
    expect(await reader.isChargeOfPaidInvoice({ chargeId: ch, paymentIntentId: null })).toBe(false);
    expect(
      await reader.isChargeOfPaidInvoice({ chargeId: ch, paymentIntentId: `${pi}_other` }),
    ).toBe(false);

    stripeRefunds.show(ch, 10_000);
    const result = await webhooks.handleChargeRefunded(
      eventOf("charge.refunded", refunded(pi, ch)),
      refunded(pi, ch),
    );
    // The invoice's refund handling: the invoice is refunded and the seller's side counts it.
    expect(result).toMatchObject({ processed: true, action: "refund_received" });
    expect((await payments.findById(paymentId))?.status).toBe("refunded");
    expect(await payouts.sumRefundLineCentsForPayment(paymentId)).toBe(10_000);
  });

  it("an invoice that recorded a different charge is not matched by its intent", async () => {
    const { pi, ch } = money();
    await webhooks.handlePaymentIntentSucceeded(
      eventOf("payment_intent.succeeded", succeeded(pi, ch)),
      succeeded(pi, ch),
    );
    expect(await reader.isChargeOfPaidInvoice({ chargeId: ch, paymentIntentId: pi })).toBe(true);
    expect(
      await reader.isChargeOfPaidInvoice({ chargeId: `${ch}_other`, paymentIntentId: pi }),
    ).toBe(false);
  });

  it("money on a cancelled invoice that finance refunds never claws back the unpaid seller", async () => {
    await reset("cancelled");
    const { pi, ch } = money();
    await webhooks.handlePaymentIntentSucceeded(
      eventOf("payment_intent.succeeded", succeeded(pi, ch)),
      succeeded(pi, ch),
    );
    // Finance refunds it from the closed-payment item (refundBlockedCapture marks it refunded).
    await runner.runInTransaction((tx) =>
      payments.applyRefundedFromCancelledInTransaction(tx, paymentId, `re_um_${run}`),
    );
    stripeRefunds.show(ch, 10_000);
    const result = await webhooks.handleChargeRefunded(
      eventOf("charge.refunded", refunded(pi, ch)),
      refunded(pi, ch),
    );
    expect(result).toMatchObject({ processed: true, action: "unapplied_money_refunded" });
    expect(await refundLines()).toEqual([]);
  });

  it("a refunded closed invoice with no task (raised before this change) is not clawed back either", async () => {
    await reset("cancelled");
    const { pi, ch } = money();
    await runner.runInTransaction((tx) =>
      payments.applyRefundedFromCancelledInTransaction(tx, paymentId, `re_um_${run}`),
    );
    stripeRefunds.show(ch, 10_000);
    const result = await webhooks.handleChargeRefunded(
      eventOf("charge.refunded", refunded(pi, ch)),
      refunded(pi, ch),
    );
    expect(result).toMatchObject({ reason: "refund_of_money_not_applied" });
    expect(await refundLines()).toEqual([]);
  });

  it("a duplicate payment on an invoice marked paid by staff, handled then refunded, claws back nobody", async () => {
    // Staff recorded the invoice as paid (no Stripe charge on it); the buyer also paid by card.
    await db.update(payment).set({ status: "captured" }).where(eq(payment.id, paymentId));
    const { pi, ch } = money();
    const result = await webhooks.handlePaymentIntentSucceeded(
      eventOf("payment_intent.succeeded", succeeded(pi, ch)),
      succeeded(pi, ch),
    );
    expect(result).toMatchObject({ reason: "invoice_already_paid" });
    // Finance marks it handled, then later refunds the duplicate in Stripe.
    const [task] = await reader.listOpen({ chargeId: ch, limit: 5 });
    await runner.runInTransaction((tx) =>
      recorder.resolve(tx, task ? [task] : [], {
        via: "staff",
        actorUserId: buyerId,
        note: "Refunding the duplicate from Stripe.",
      }),
    );
    stripeRefunds.show(ch, 10_000);
    const refund = await webhooks.handleChargeRefunded(
      eventOf("charge.refunded", refunded(pi, ch)),
      refunded(pi, ch),
    );
    expect(refund).toMatchObject({ processed: true, action: "unapplied_money_refunded" });
    expect((await payments.findById(paymentId))?.status).toBe("captured");
    expect(await refundLines()).toEqual([]);
  });

  it("concurrent partial refund events record the charge's total once, whichever is handled first", async () => {
    const { pi, ch } = money();
    await webhooks.handlePaymentIntentSucceeded(
      eventOf("payment_intent.succeeded", succeeded(pi, ch)),
      succeeded(pi, ch),
    );
    const upTo = (refundedPence: number) =>
      ({ ...refunded(pi, ch), amount_refunded: refundedPence }) as Stripe.Charge;
    // Each event reports a running total (40.00, then 75.00). Without the payment lock both read
    // nothing recorded, and the buyer and the seller would be given 115.00 between them.
    // Both events read Stripe's list once both refunds went through: 75.00 in all.
    stripeRefunds.show(ch, 7_500);
    const results = await Promise.all([
      webhooks.handleChargeRefunded(eventOf("charge.refunded", upTo(4_000)), upTo(4_000)),
      webhooks.handleChargeRefunded(eventOf("charge.refunded", upTo(7_500)), upTo(7_500)),
    ]);
    expect(results.map((r) => r.processed)).toEqual([true, true]);
    expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(7_500);
    // Not paid out: the seller is charged nothing, and their side counts the 75.00 as dealt with.
    expect(await refundLines()).toEqual([]);
    expect(await payouts.sumRefundLineCentsForPayment(paymentId)).toBe(7_500);
  });

  it("a staff refund and a card refund event for the same money are recorded once", async () => {
    const { pi, ch } = money();
    await webhooks.handlePaymentIntentSucceeded(
      eventOf("payment_intent.succeeded", succeeded(pi, ch)),
      succeeded(pi, ch),
    );
    const staffRefund = runner.runInTransaction(async (tx) => {
      await refundRecords.lockPaymentInTransaction(tx, paymentId);
      if (!(await payments.applyRefundedInTransaction(tx, paymentId, `re_um_${run}`))) return;
      await refundRecords.recordInTransaction(tx, {
        paymentId,
        idempotencyKey: `admin_refund:${paymentId}`,
        stripeRefundId: `re_um_${run}`,
        amountPence: 10_000,
        currency: "GBP",
        source: "staff",
      });
      await payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: sellerId,
        paymentId,
        amount: "-100.00",
        kind: "refund",
        sourceEventId: `admin_refund:${paymentId}`,
        note: "Admin refund",
        tx,
      });
    });
    stripeRefunds.show(ch, 10_000);
    const cardEvent = webhooks.handleChargeRefunded(
      eventOf("charge.refunded", refunded(pi, ch)),
      refunded(pi, ch),
    );
    await Promise.all([staffRefund, cardEvent]);
    expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(10_000);
    // Not paid out: nothing is taken back from the seller, and the refund is announced once.
    expect(await refundLines()).toEqual([]);
    expect(await payouts.sumRefundLineCentsForPayment(paymentId)).toBe(10_000);
    const announced = await db
      .select({ id: domainEvent.id })
      .from(domainEvent)
      .where(
        and(eq(domainEvent.aggregateId, paymentId), eq(domainEvent.eventType, "payment.refunded")),
      );
    expect(announced.length).toBeLessThanOrEqual(1);
  });
});
