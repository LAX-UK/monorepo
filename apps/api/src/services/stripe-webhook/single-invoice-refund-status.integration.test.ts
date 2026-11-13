import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  consignmentAgreement,
  domainEvent,
  itemSubmission,
  legalEntity,
  lot,
  payment,
  paymentRefund,
  payout,
  payoutLine,
  processedStripeEvents,
  saleSellerTerms,
  stripeRefundReversal,
  stripeRefundWatch,
} from "@auction/db/schema";
import {
  type PayoutSettlementDeps,
  createSettlement,
  payoutRepoForTx,
  settlementSellerTermsForTx,
} from "@auction/finance-runtime";
import {
  DrizzlePaymentRefundRepository,
  DrizzlePaymentRepository,
  DrizzlePaymentWebhookLookupReader,
  DrizzlePayoutRepository,
  DrizzleStripeRefundWatchRepository,
  DrizzleUnappliedMoneyReader,
} from "@auction/persistence/repositories";
import { and, eq, inArray, like } from "drizzle-orm";
import { ok } from "neverthrow";
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
import { StripeRefundReconcileService } from "./stripe-refund-reconcile.service.js";
import { UnappliedMoneyRefundHandler } from "./unapplied-money-refund.handler.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * A single invoice's card refund as its status moves on at Stripe, end to end through the
 * webhooks, the refund watch table and the reconcile job: only a refund that succeeded is
 * recorded and announced, once, with or without `charge.refund.updated`; a refund counted by the
 * previous release that then failed is taken back once. The seller is charged nothing for a refund
 * before payout: the payout run charges their share of it as it pays the sale (£80 hammer at 15% +
 * VAT pays £65.60 of the £100 invoice, so £25 refunded is charged at £16.40).
 */
describe.skipIf(!HAS_DB)(
  "single-invoice refunds count only once they succeed (integration)",
  () => {
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
    const watch = new DrizzleStripeRefundWatchRepository(db);
    let stripe = new FakeChargeRefunds(watch);
    const service = () =>
      new StripePaymentWebhookService(
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
          chargeRefunds: stripe,
        }),
        null,
        refundRecords,
        undefined,
        null,
        stripe,
      );
    let webhooks = service();
    // The job's clock: moved past each refund's backoff so a run finds it due.
    let clock = new Date();
    const completeStaffRefund = vi.fn(async () => ok(undefined));
    const job = () =>
      new StripeRefundReconcileService({
        watch,
        refunds: stripe,
        settleCharge: (event, charge) => webhooks.handleChargeRefunded(event, charge),
        completeStaffRefund,
        now: () => clock,
      });
    const runJob = async () => {
      clock = new Date(clock.getTime() + 7 * 60 * 60_000);
      return job().run({ limit: 200 });
    };

    const run = randomUUID().slice(0, 8);
    const buyerId = `sr-buyer-${run}`;
    const buyerEntityId = randomUUID();
    const sellerId = randomUUID();
    const lotId = randomUUID();
    const submissionId = randomUUID();
    let agreementId: string;
    let paymentId: string;
    let pi: string;
    let ch: string;

    const eventOf = (type: string, object: unknown, id = `evt_sr_${run}_${randomUUID()}`) =>
      ({ id, type, data: { object } }) as unknown as Stripe.Event;
    const chargeObject = () =>
      ({
        id: ch,
        amount: 10_000,
        // What the event carries is not read: Stripe's refund list is.
        amount_refunded: 10_000,
        currency: "gbp",
        payment_intent: pi,
        metadata: { paymentId },
      }) as unknown as Stripe.Charge;
    const refundObject = (id: string) =>
      ({ id, charge: ch, payment_intent: pi, currency: "gbp" }) as Stripe.Refund;
    const buyerRows = () =>
      db
        .select({ amount: paymentRefund.amountPence, source: paymentRefund.source })
        .from(paymentRefund)
        .where(eq(paymentRefund.paymentId, paymentId));
    const sellerLines = async () =>
      (
        await db
          .select({ amount: payoutLine.amount })
          .from(payoutLine)
          .where(and(eq(payoutLine.paymentId, paymentId), eq(payoutLine.kind, "refund")))
      ).map((l) => Number(l.amount));
    const announced = async (eventType: string) =>
      db
        .select({ payload: domainEvent.payload })
        .from(domainEvent)
        .where(and(eq(domainEvent.aggregateId, paymentId), eq(domainEvent.eventType, eventType)));
    const statusOf = async () => (await payments.findById(paymentId))?.status;
    const watchRow = async (id: string) =>
      (
        await db.select().from(stripeRefundWatch).where(eq(stripeRefundWatch.stripeRefundId, id))
      )[0];

    // The payout run, as the API runs it: each sale paid from its seller-terms snapshot.
    const settlementDeps: PayoutSettlementDeps = {
      repo: payouts,
      transactionRunner: runner,
      domainEventSink: { withTx: () => ({ publish: async () => undefined }) },
      payoutAdjustments: undefined,
      payoutRepoForTx: (tx) => payoutRepoForTx(payouts, tx),
      sellerTermsForTx: settlementSellerTermsForTx,
    };
    /** The run's sale line: the £80 hammer, paid from the snapshot. */
    const SALE_LINE = { kind: "sale", amount: 80, buyerRefundPence: null };
    /**
     * Runs the seller's payout: what it transfers, and its lines for this payment. The sale line
     * carries the £80 hammer; the £14.40 commission and VAT come off it in the payout's net.
     */
    const payOut = async () => {
      const settled = await createSettlement(settlementDeps, null, {
        legalEntityId: sellerId,
        periodEnd: new Date(Date.now() + 60_000),
      });
      if (!settled.ok) throw new Error(`the sale was not paid out: ${settled.reason}`);
      const lines = await db
        .select({
          kind: payoutLine.kind,
          amount: payoutLine.amount,
          buyerRefundPence: payoutLine.buyerRefundPence,
        })
        .from(payoutLine)
        .where(
          and(eq(payoutLine.payoutId, settled.payout.id), eq(payoutLine.paymentId, paymentId)),
        );
      return {
        net: Number(settled.payout.netAmount),
        lines: lines
          .map((l) => ({ ...l, amount: Number(l.amount) }))
          .sort((a, b) => a.kind.localeCompare(b.kind)),
      };
    };
    /** The sale is paid out and the payout settled, so a refund now charges the seller's share. */
    const paidOut = async () => {
      expect(await payOut()).toEqual({ net: 65.6, lines: [SALE_LINE] });
      await db
        .update(payout)
        .set({ status: "paid" })
        .where(and(eq(payout.legalEntityId, sellerId), eq(payout.status, "scheduled")));
    };
    /** What the seller's refund lines add up to, in pounds. */
    const sellerCharged = async () => (await sellerLines()).reduce((a, b) => a + b, 0);
    /** A refund line the previous release wrote before payout (no buyer refund kept), on its own payout. */
    const oldReleaseLine = async (amount: string, key: string) => {
      const [old] = await db
        .insert(payout)
        .values({
          legalEntityId: sellerId,
          periodStart: new Date("2026-10-03T00:00:00Z"),
          periodEnd: new Date("2026-10-03T00:00:01Z"),
          grossAmount: amount,
          platformFee: "0.00",
          stripeFee: "0.00",
          netAmount: amount,
          currency: "GBP",
          status: "paid",
        })
        .returning({ id: payout.id });
      if (!old) throw new Error("payout was not stored");
      await db.insert(payoutLine).values({
        payoutId: old.id,
        paymentId,
        amount,
        kind: "refund",
        note: "Refund",
        sourceEventId: key,
      });
    };

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
      await db.insert(itemSubmission).values({
        id: submissionId,
        legalEntityId: sellerId,
        title: "Consigned work",
        convertedLotId: lotId,
      });
      const [agreement] = await db
        .insert(consignmentAgreement)
        .values({
          submissionId,
          legalEntityId: sellerId,
          termsVersion: "v1",
          commissionPercent: "15.00",
          acceptedAt: new Date("2026-10-01T10:00:00Z"),
        })
        .returning({ id: consignmentAgreement.id });
      agreementId = agreement?.id as string;
    });

    const clear = async () => {
      const old = (
        await db.select({ id: payment.id }).from(payment).where(eq(payment.lotId, lotId))
      ).map((r) => r.id);
      if (old.length) {
        await db.delete(paymentRefund).where(inArray(paymentRefund.paymentId, old));
        await db.delete(payoutLine).where(inArray(payoutLine.paymentId, old));
        await db.delete(domainEvent).where(inArray(domainEvent.aggregateId, old));
        await db.delete(saleSellerTerms).where(inArray(saleSellerTerms.paymentId, old));
      }
      await db.delete(payout).where(eq(payout.legalEntityId, sellerId));
      await db
        .delete(stripeRefundWatch)
        .where(like(stripeRefundWatch.stripeChargeId, `ch_sr_${run}_%`));
      await db
        .delete(stripeRefundReversal)
        .where(like(stripeRefundReversal.stripeRefundId, `re_sr_${run}_%`));
      await db.delete(payment).where(eq(payment.lotId, lotId));
    };

    beforeEach(async () => {
      await clear();
      stripe = new FakeChargeRefunds(watch);
      webhooks = service();
      completeStaffRefund.mockClear();
      pi = `pi_sr_${run}_${randomUUID()}`;
      ch = `ch_sr_${run}_${randomUUID()}`;
      const [row] = await db
        .insert(payment)
        .values({
          lotId,
          buyerId,
          buyerLegalEntityId: buyerEntityId,
          sellerLegalEntityId: sellerId,
          amount: "100.00",
          platformFee: "5.00",
          status: "pending",
        })
        .returning({ id: payment.id });
      paymentId = row?.id as string;
      // Raised on an £80 hammer and £20 premium at 15% + VAT: the seller is paid £65.60.
      await db.insert(saleSellerTerms).values({
        paymentId,
        lotId,
        sellerLegalEntityId: sellerId,
        agreementId,
        basis: "agreement",
        hammerPence: 8_000,
        premiumPence: 2_000,
        commissionBps: 1500,
        commissionPence: 1_200,
        commissionVatTreatment: "standard",
        commissionVatBps: 2000,
        commissionVatPence: 240,
        sellerNetPence: 6_560,
        ruleVersion: "agreement_hammer_v1",
      });
      const succeededIntent = {
        id: pi,
        amount: 10_000,
        amount_received: 10_000,
        currency: "gbp",
        metadata: { paymentId },
        latest_charge: ch,
      } as unknown as Stripe.PaymentIntent;
      await webhooks.handlePaymentIntentSucceeded(
        eventOf("payment_intent.succeeded", succeededIntent),
        succeededIntent,
      );
      expect(await statusOf()).toBe("captured");
      stripe.charges.set(ch, chargeObject());
    });

    afterAll(async () => {
      await clear();
      await db
        .delete(consignmentAgreement)
        .where(eq(consignmentAgreement.submissionId, submissionId));
      await db.delete(itemSubmission).where(eq(itemSubmission.id, submissionId));
      await db.delete(lot).where(eq(lot.id, lotId));
      await db
        .delete(processedStripeEvents)
        .where(like(processedStripeEvents.eventId, `%_sr_${run}_%`));
      await db
        .delete(processedStripeEvents)
        .where(like(processedStripeEvents.eventId, "refund_reconcile:re_sr_%"));
      await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerEntityId, sellerId]));
      await deleteIdentityUserFixtures(db, [buyerId]);
    });

    it("pending, then succeeded with no charge.refund.updated: the job counts it once", async () => {
      const re = `re_sr_${run}_${randomUUID()}`;
      stripe.add({ id: re, chargeId: ch, amountPence: 2_500, status: "pending" });
      const created = eventOf("charge.refunded", chargeObject());
      expect(await webhooks.handleChargeRefunded(created, chargeObject())).toMatchObject({
        reason: "no_new_refund_amount",
      });
      expect(await buyerRows()).toEqual([]);
      expect(await sellerLines()).toEqual([]);
      expect(await watchRow(re)).toMatchObject({ status: "pending", settledAt: null });

      // Still pending at the first look: checked again later, nothing recorded.
      expect(await runJob()).toMatchObject({ stillPending: 1, settled: 0 });
      expect(await buyerRows()).toEqual([]);

      stripe.setStatus(re, "succeeded");
      expect(await runJob()).toMatchObject({ settled: 1 });
      expect(await buyerRows()).toEqual([{ amount: 2_500, source: "card_webhook" }]);
      // Before payout the seller is charged nothing yet.
      expect(await sellerLines()).toEqual([]);
      expect(await announced("payment.refunded")).toHaveLength(1);
      expect((await watchRow(re))?.settledAt).not.toBeNull();

      // The job again, the first event redelivered, a later event and a late update: nothing more.
      expect(await runJob()).toMatchObject({ checked: 0 });
      expect(await webhooks.handleChargeRefunded(created, chargeObject())).toMatchObject({
        reason: "duplicate_event",
      });
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      await webhooks.handleChargeRefundUpdated(
        eventOf("charge.refund.updated", refundObject(re)),
        refundObject(re),
      );
      expect(await buyerRows()).toHaveLength(1);
      expect(await sellerLines()).toEqual([]);
      expect(await announced("payment.refunded")).toHaveLength(1);
      expect(await statusOf()).toBe("captured");

      // The payout run pays the sale and charges the seller's share of the £25, once.
      expect(await payOut()).toEqual({
        net: 49.2,
        lines: [{ kind: "refund", amount: -16.4, buyerRefundPence: 2_500 }, SALE_LINE],
      });
      // The job and a later event after payout: the £25 is already answered for, nothing more.
      expect(await runJob()).toMatchObject({ checked: 0 });
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      expect(await buyerRows()).toHaveLength(1);
      expect(await sellerLines()).toEqual([-16.4]);
      expect(await announced("payment.refunded")).toHaveLength(1);
    });

    it("requires_action, then succeeded in full: counted once and the invoice is refunded", async () => {
      // The sale was paid out first, so the refund charges the seller's whole £65.60 share.
      await paidOut();
      const re = `re_sr_${run}_${randomUUID()}`;
      stripe.add({ id: re, chargeId: ch, amountPence: 10_000, status: "requires_action" });
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      expect(await statusOf()).toBe("captured");
      stripe.setStatus(re, "succeeded");
      // Webhook and job both see it, the update first: one record, one notice.
      await webhooks.handleChargeRefundUpdated(
        eventOf("charge.refund.updated", refundObject(re)),
        refundObject(re),
      );
      await runJob();
      expect(await buyerRows()).toEqual([{ amount: 10_000, source: "card_webhook" }]);
      expect(await sellerLines()).toEqual([-65.6]);
      expect(await announced("payment.refunded")).toHaveLength(1);
      expect(await statusOf()).toBe("refunded");
      // The job and a late refund event once it is settled: nothing more is charged.
      await runJob();
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      expect(await buyerRows()).toHaveLength(1);
      expect(await sellerLines()).toEqual([-65.6]);
      expect(await announced("payment.refunded")).toHaveLength(1);
    });

    it("pending, then failed: nothing is ever recorded, clawed back or announced; a later real refund is counted once", async () => {
      const re = `re_sr_${run}_${randomUUID()}`;
      stripe.add({ id: re, chargeId: ch, amountPence: 2_500, status: "pending" });
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      stripe.setStatus(re, "failed");
      expect(await runJob()).toMatchObject({ settled: 1 });
      expect(await buyerRows()).toEqual([]);
      expect(await sellerLines()).toEqual([]);
      expect(await announced("payment.refunded")).toEqual([]);
      expect(await announced("payment.refund_reversed")).toEqual([]);
      expect((await watchRow(re))?.status).toBe("failed");

      const second = `re_sr_${run}_${randomUUID()}`;
      stripe.add({ id: second, chargeId: ch, amountPence: 2_500, status: "succeeded" });
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      expect(await buyerRows()).toEqual([{ amount: 2_500, source: "card_webhook" }]);
      expect(await announced("payment.refunded")).toHaveLength(1);
    });

    it("events out of order: a late charge.refunded after the update adds nothing", async () => {
      const re = `re_sr_${run}_${randomUUID()}`;
      stripe.add({ id: re, chargeId: ch, amountPence: 4_000, status: "succeeded" });
      await webhooks.handleChargeRefundUpdated(
        eventOf("charge.refund.updated", refundObject(re)),
        refundObject(re),
      );
      expect(
        await webhooks.handleChargeRefunded(
          eventOf("charge.refunded", chargeObject()),
          chargeObject(),
        ),
      ).toMatchObject({ reason: "no_new_refund_amount" });
      expect(await buyerRows()).toEqual([{ amount: 4_000, source: "card_webhook" }]);
      expect(await sellerLines()).toEqual([]);
      expect(await announced("payment.refunded")).toHaveLength(1);

      // The payout run charges the seller's share of the £40 (£26.24), once.
      expect(await payOut()).toEqual({
        net: 39.36,
        lines: [{ kind: "refund", amount: -26.24, buyerRefundPence: 4_000 }, SALE_LINE],
      });
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      expect(await sellerLines()).toEqual([-26.24]);
      expect(await announced("payment.refunded")).toHaveLength(1);
    });

    it("a refund the previous release counted while pending, which then failed, is taken back once", async () => {
      // As the previous release left it: the full refund recorded, the seller clawed back, the
      // invoice marked refunded and announced, while Stripe's refund was still pending.
      const re = `re_sr_${run}_${randomUUID()}`;
      stripe.add({ id: re, chargeId: ch, amountPence: 10_000, status: "pending" });
      await runner.runInTransaction(async (tx) => {
        await refundRecords.lockPaymentInTransaction(tx, paymentId);
        await payments.applyRefundedInTransaction(tx, paymentId, null);
        await refundRecords.recordInTransaction(tx, {
          paymentId,
          idempotencyKey: `evt_sr_${run}_old`,
          amountPence: 10_000,
          currency: "GBP",
          source: "card_webhook",
        });
      });
      // The previous release charged the whole £100 before payout.
      await oldReleaseLine("-100.00", `evt_sr_${run}_old`);
      await watch.watch([
        {
          stripeRefundId: re,
          stripeChargeId: ch,
          status: "pending",
          amountPence: 10_000,
          paymentId,
        },
      ]);
      expect(await statusOf()).toBe("refunded");

      stripe.setStatus(re, "failed");
      expect(await runJob()).toMatchObject({ settled: 1 });
      // The job again, and a refund event for the same charge: nothing more is taken back.
      await runJob();
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );

      expect((await buyerRows()).map((r) => [r.amount, r.source])).toEqual([
        [10_000, "card_webhook"],
        [-10_000, "refund_reversal"],
      ]);
      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(0);
      // The whole £100 charge is given back on one line.
      expect((await sellerLines()).sort((a, b) => a - b)).toEqual([-100, 100]);
      expect(await sellerCharged()).toBeCloseTo(0, 2);
      // The backfill reads the seller's lines with their sign, so it adds nothing back.
      await runner.runInTransaction((tx) => refundRecords.lockPaymentInTransaction(tx, paymentId));
      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(0);
      const reversed = await announced("payment.refund_reversed");
      expect(reversed).toHaveLength(1);
      expect(reversed[0]?.payload).toMatchObject({
        amountCents: 10_000,
        cumulativeRefundedCents: 0,
      });
      expect(await statusOf()).toBe("captured");

      // Nothing refunded now: the payout run pays the sale in full, with no refund line.
      expect(await payOut()).toEqual({ net: 65.6, lines: [SALE_LINE] });
      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(0);

      // A real refund after payout is counted, once, and charges the seller's £65.60 share.
      stripe.add({
        id: `re_sr_${run}_${randomUUID()}`,
        chargeId: ch,
        amountPence: 10_000,
        status: "succeeded",
      });
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(10_000);
      expect(await sellerCharged()).toBeCloseTo(-65.6, 2);
      expect(await statusOf()).toBe("refunded");
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(10_000);
      expect(await sellerCharged()).toBeCloseTo(-65.6, 2);
    });

    it("a succeeded refund that Stripe later reports failed is taken back once, by the update or the job", async () => {
      const re = `re_sr_${run}_${randomUUID()}`;
      stripe.add({ id: re, chargeId: ch, amountPence: 3_000, status: "succeeded" });
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );
      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(3_000);

      stripe.setStatus(re, "failed");
      const update = eventOf("charge.refund.updated", refundObject(re));
      expect(await webhooks.handleChargeRefundUpdated(update, refundObject(re))).toMatchObject({
        action: "refund_reversed",
      });
      // Redelivered, then another update and a refund event: nothing more is taken back.
      expect(await webhooks.handleChargeRefundUpdated(update, refundObject(re))).toMatchObject({
        reason: "duplicate_event",
      });
      await webhooks.handleChargeRefundUpdated(
        eventOf("charge.refund.updated", refundObject(re)),
        refundObject(re),
      );
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );

      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(0);
      expect((await sellerLines()).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 2);
      expect(await announced("payment.refunded")).toHaveLength(1);
      expect(await announced("payment.refund_reversed")).toHaveLength(1);
      expect(await statusOf()).toBe("captured");
    });

    it("a refund over Stripe's figure that no failed refund explains is left for finance", async () => {
      await runner.runInTransaction(async (tx) => {
        await refundRecords.lockPaymentInTransaction(tx, paymentId);
        await refundRecords.recordInTransaction(tx, {
          paymentId,
          idempotencyKey: `staff_bank:${run}`,
          amountPence: 1_000,
          currency: "GBP",
          source: "staff",
        });
      });
      expect(
        await webhooks.handleChargeRefunded(
          eventOf("charge.refunded", chargeObject()),
          chargeObject(),
        ),
      ).toMatchObject({ reason: "no_new_refund_amount" });
      expect(await buyerRows()).toEqual([{ amount: 1_000, source: "staff" }]);
      expect(await announced("payment.refund_reversed")).toEqual([]);
    });

    /**
     * As the previous release left a refund it counted while pending: recorded, and charged to the
     * seller in full before payout.
     */
    const countedByPreviousRelease = async (amountPence: number, key: string) => {
      await runner.runInTransaction(async (tx) => {
        await refundRecords.lockPaymentInTransaction(tx, paymentId);
        await refundRecords.recordInTransaction(tx, {
          paymentId,
          idempotencyKey: key,
          amountPence,
          currency: "GBP",
          source: "card_webhook",
        });
      });
      await oldReleaseLine((-amountPence / 100).toFixed(2), key);
    };

    it("staff £10 outside Stripe and £25 counted while pending that then failed: the webhook and then the job take the £25 back once", async () => {
      // £10 refunded by staff outside Stripe (left for finance): before payout, nothing is charged
      // to the seller yet.
      await runner.runInTransaction(async (tx) => {
        await refundRecords.lockPaymentInTransaction(tx, paymentId);
        await refundRecords.recordInTransaction(tx, {
          paymentId,
          idempotencyKey: `staff_bank:${run}:${paymentId}`,
          amountPence: 1_000,
          currency: "GBP",
          source: "staff",
        });
        await payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
          legalEntityId: sellerId,
          paymentId,
          amount: "-10.00",
          kind: "refund",
          sourceEventId: `staff_bank:${run}:${paymentId}`,
          note: "Refund outside Stripe",
          tx,
        });
      });
      expect(await sellerLines()).toEqual([]);
      const re = `re_sr_${run}_${randomUUID()}`;
      stripe.add({ id: re, chargeId: ch, amountPence: 2_500, status: "pending" });
      await countedByPreviousRelease(2_500, `evt_sr_${run}_old_${paymentId}`);
      await watch.watch([
        {
          stripeRefundId: re,
          stripeChargeId: ch,
          status: "pending",
          amountPence: 2_500,
          paymentId,
        },
      ]);

      stripe.setStatus(re, "failed");
      expect(
        await webhooks.handleChargeRefundUpdated(
          eventOf("charge.refund.updated", refundObject(re)),
          refundObject(re),
        ),
      ).toMatchObject({ action: "refund_reversed" });
      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(1_000);

      // The job settles the same failed refund, then another refund event arrives: nothing more.
      expect(await runJob()).toMatchObject({ settled: 1 });
      await webhooks.handleChargeRefunded(
        eventOf("charge.refunded", chargeObject()),
        chargeObject(),
      );

      expect((await buyerRows()).map((r) => [r.amount, r.source])).toEqual([
        [1_000, "staff"],
        [2_500, "card_webhook"],
        [-2_500, "refund_reversal"],
      ]);
      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(1_000);
      // The previous release's £25 charge is given back once; the staff £10 is not charged yet.
      expect((await sellerLines()).sort((a, b) => a - b)).toEqual([-25, 25]);
      const reversed = await announced("payment.refund_reversed");
      expect(reversed).toHaveLength(1);
      expect(reversed[0]?.payload).toMatchObject({ amountCents: 2_500 });

      // The payout run charges the seller's share of the £10 still standing (£6.56), and nothing
      // for the failed £25.
      expect(await payOut()).toEqual({
        net: 59.04,
        lines: [{ kind: "refund", amount: -6.56, buyerRefundPence: 1_000 }, SALE_LINE],
      });
      expect(await sellerCharged()).toBeCloseTo(-6.56, 2);
      expect((await refundRecords.sumRefundedPence(paymentId)).pence).toBe(1_000);
    });

    it("an event that read Stripe's list before a refund succeeded takes nothing back once it holds the payment", async () => {
      // R1 £25 failed, R2 £25 pending. Event X reads the list; R2 then succeeds and event Y
      // records it before X takes the payment's lock.
      const r1 = `re_sr_${run}_${randomUUID()}`;
      const r2 = `re_sr_${run}_${randomUUID()}`;
      stripe.add({ id: r1, chargeId: ch, amountPence: 2_500, status: "failed" });
      stripe.add({ id: r2, chargeId: ch, amountPence: 2_500, status: "pending" });
      const read = stripe.listChargeRefunds.bind(stripe);
      vi.spyOn(stripe, "listChargeRefunds").mockImplementationOnce(async (chargeId) => {
        const stale = await read(chargeId);
        stripe.setStatus(r2, "succeeded");
        expect(
          await webhooks.handleChargeRefundUpdated(
            eventOf("charge.refund.updated", refundObject(r2)),
            refundObject(r2),
          ),
        ).toMatchObject({ action: "refund_received" });
        return stale;
      });

      expect(
        await webhooks.handleChargeRefunded(
          eventOf("charge.refunded", chargeObject()),
          chargeObject(),
        ),
      ).toMatchObject({ reason: "no_new_refund_amount" });

      expect(await buyerRows()).toEqual([{ amount: 2_500, source: "card_webhook" }]);
      expect(await sellerLines()).toEqual([]);
      expect(await announced("payment.refunded")).toHaveLength(1);
      expect(await announced("payment.refund_reversed")).toEqual([]);

      // The payout run charges the seller's share of the £25 that succeeded, and nothing for R1.
      expect(await payOut()).toEqual({
        net: 49.2,
        lines: [{ kind: "refund", amount: -16.4, buyerRefundPence: 2_500 }, SALE_LINE],
      });
      expect(await sellerLines()).toEqual([-16.4]);
    });
  },
);
