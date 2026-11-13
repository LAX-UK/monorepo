import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidInvoice,
  bidInvoiceLine,
  disputeAllocation,
  disputeCase,
  legalEntity,
  lot,
  payment,
  paymentGroup,
  paymentRefund,
  payout,
  payoutLine,
  processedStripeEvents,
} from "@auction/db/schema";
import { UNAPPLIED_MONEY_EVENT } from "@auction/domain";
import { PaymentEligibilityGate } from "@auction/finance-runtime";
import {
  DrizzleBidInvoiceRepository,
  DrizzleDisputeCaseRepository,
  DrizzleDisputePaymentReader,
  DrizzlePaymentGroupRepository,
  DrizzlePaymentRefundRepository,
  DrizzlePaymentRepository,
  DrizzlePaymentWebhookLookupReader,
  DrizzlePayoutRepository,
  DrizzleUnappliedMoneyReader,
  createDrizzleLegalEntityRepository,
} from "@auction/persistence/repositories";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { DisputeAllocationService } from "../disputes/dispute-allocation.service.js";
import { DisputeCaseRecorder } from "../disputes/dispute-case-recorder.js";
import { DisputeLineEffects } from "../disputes/dispute-line-effects.js";
import { PaymentCaptureService } from "../payment/payment-capture.service.js";
import { UnappliedMoneyRecorder } from "../payment/unapplied-money.recorder.js";
import { PayoutAdjustmentService } from "../payout/payout-adjustment.service.js";
import { StripePaymentWebhookService } from "../stripe-payment-webhook.service.js";
import { PAYMENT_WEBHOOK_EVENT_SOURCE } from "../stripe-webhook/payment-webhook-types.js";
import { OpenGroupCheckouts } from "./open-group-checkouts.js";
import { PaymentGroupChargeEvents } from "./payment-group-charge-events.js";
import { PaymentGroupCheckoutService } from "./payment-group-checkout.service.js";
import type {
  GroupChargeRefund,
  GroupCheckoutStatus,
  IPaymentGroupGateway,
} from "./payment-group-ports.js";
import { PaymentGroupSettlementService } from "./payment-group-settlement.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("pay several: one payment for several invoices (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const runner = transactionRunnerFromDb(db);
  const payments = new DrizzlePaymentRepository(db);
  const groups = new DrizzlePaymentGroupRepository(db);
  const payouts = new DrizzlePayoutRepository(db);
  const publish = vi.fn().mockResolvedValue(undefined);
  const events = mockDomainEventSink(publish);
  const receipt = { send: vi.fn().mockResolvedValue(undefined) };
  let chargeRefunds: GroupChargeRefund[] = [];
  const gateway: IPaymentGroupGateway & {
    createCheckout: ReturnType<typeof vi.fn>;
    checkoutStatus: ReturnType<typeof vi.fn<(sessionId: string) => Promise<GroupCheckoutStatus>>>;
  } = {
    isConfigured: () => true,
    createCheckout: vi.fn(async (input: { paymentGroupId: string }) => ({
      sessionId: `cs_${input.paymentGroupId}`,
      url: `https://checkout.example/${input.paymentGroupId}`,
      paymentIntentId: `pi_${input.paymentGroupId}`,
    })),
    expireCheckout: vi.fn().mockResolvedValue(undefined),
    checkoutStatus: vi
      .fn<(sessionId: string) => Promise<GroupCheckoutStatus>>()
      .mockResolvedValue("expired"),
    bankTransferInstructions: vi.fn().mockResolvedValue(null),
    listChargeRefunds: vi.fn(async () => chargeRefunds),
  };
  const claims = {
    claim: async (tx: typeof db, eventId: string) =>
      (await tryClaimProcessedStripeEvent(tx, eventId, PAYMENT_WEBHOOK_EVENT_SOURCE)).claimed,
  };
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
  );
  const payoutAdjustments = new PayoutAdjustmentService(
    runner,
    payouts,
    (_root, tx) => new DrizzlePayoutRepository(tx),
  );
  const settlement = new PaymentGroupSettlementService({
    transactionRunner: runner,
    groups,
    payments,
    capture,
    events,
    claims,
    receipt,
    unappliedMoney: new UnappliedMoneyRecorder(new DrizzleUnappliedMoneyReader(db), events),
    eligibility: new PaymentEligibilityGate(createDrizzleLegalEntityRepository(db), null),
  });
  const checkout = new PaymentGroupCheckoutService({
    groups,
    invoices: new DrizzleBidInvoiceRepository(db),
    gateway,
    stripeCustomers: { isConfigured: () => true, findOrCreateForLegalEntity: async () => "cus_1" },
    users: {
      findById: async (id: string) => ({ id, email: `${id}@integration.test`, name: "Payer" }),
    } as never,
    singleCheckouts: { revoke: vi.fn().mockResolvedValue(undefined) },
    openCheckouts: new OpenGroupCheckouts({ groups, gateway, settlement }),
    accounting: { ensureInvoices: async () => true },
    settlement,
    events,
    webOrigin: "https://lax.example",
  });
  const paymentRefunds = new DrizzlePaymentRefundRepository(db);
  const chargeEvents = new PaymentGroupChargeEvents({
    transactionRunner: runner,
    groups,
    gateway,
    payments,
    payoutAdjustments,
    paymentRefunds,
    sellerRefundedCents: (tx, paymentId) =>
      new DrizzlePayoutRepository(tx).sumRefundLineCentsForPayment(paymentId),
    events,
    claims,
  });
  const disputeCases = new DrizzleDisputeCaseRepository(db);
  const disputePayments = new DrizzleDisputePaymentReader();
  const disputeEffects = new DisputeLineEffects({ cases: disputeCases, payoutAdjustments, events });
  const disputes = new DisputeCaseRecorder({
    transactionRunner: runner,
    claims,
    cases: disputeCases,
    payments: disputePayments,
    effects: disputeEffects,
    events,
  });
  const allocation = new DisputeAllocationService({
    transactionRunner: runner,
    cases: disputeCases,
    payments: disputePayments,
    effects: disputeEffects,
    events,
  });
  const webhooks = new StripePaymentWebhookService(
    runner,
    new DrizzlePaymentWebhookLookupReader(db),
    payments,
    payouts,
    payoutAdjustments,
    capture,
    events,
    disputes,
    { settlement, chargeEvents, groups, payments, gateway },
  );

  const run = randomUUID().slice(0, 8);
  const payerId = `ps-payer-${run}`;
  const orgId = randomUUID();
  const sellerId = randomUUID();
  const lotIds = Array.from({ length: 3 }, () => randomUUID());
  let ids: { a: string; b: string; c: string };

  const eventOf = (type: string, object: unknown, id = `evt_ps_${run}_${randomUUID()}`) =>
    ({ id, type, data: { object } }) as unknown as Stripe.Event;
  const intent = (over: Partial<Stripe.PaymentIntent> & { metadata: Stripe.Metadata }) =>
    ({
      id: `pi_${randomUUID()}`,
      amount: 0,
      currency: "gbp",
      latest_charge: `ch_${randomUUID()}`,
      ...over,
    }) as Stripe.PaymentIntent;

  const start = (invoiceIds: string[]) =>
    checkout.start({
      payerUserId: payerId,
      buyerLegalEntityId: orgId,
      currency: "GBP",
      total: `${invoiceIds.length * 100}.00`,
      rail: "card",
      invoices: invoiceIds.map((paymentId) => ({ paymentId, lotId: "", amount: "100.00" })),
      deliveries: [],
    });
  const startOk = async (invoiceIds: string[]) => {
    const started = await start(invoiceIds);
    if (started.isErr()) throw new Error(`expected a checkout, got ${started.error}`);
    return started.value.paymentGroupId;
  };
  const statusOf = async (paymentId: string) => {
    const row = await payments.findById(paymentId);
    return { status: row?.status, group: row?.paymentGroupId ?? null };
  };
  const succeeded = (groupId: string, over: Partial<Stripe.PaymentIntent> = {}) =>
    intent({ amount: 20_000, metadata: { paymentGroupId: groupId }, ...over });

  beforeAll(async () => {
    const now = new Date();
    await seedIdentityUserFixtures(db, [
      { id: payerId, name: "Payer", email: `${payerId}@integration.test` },
    ]);
    await db.insert(legalEntity).values([
      {
        id: orgId,
        displayName: "Gallery",
        kind: "organisation",
        subkind: "gallery",
        createdByUserId: payerId,
        status: "approved",
      },
      {
        id: sellerId,
        displayName: "Seller",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: payerId,
        status: "approved",
      },
    ]);
    await db.insert(lot).values(
      lotIds.map((id, i) => ({
        id,
        title: `Work ${i}`,
        images: [],
        auctionType: "english" as const,
        startingPrice: "10.00",
        currentPrice: "100.00",
        minBidIncrement: "10.00",
        startTime: new Date(now.getTime() - 3 * 86_400_000),
        endTime: new Date(now.getTime() - 86_400_000),
        status: "ended" as const,
        sellerLegalEntityId: sellerId,
        winnerId: payerId,
        buyerLegalEntityId: orgId,
      })),
    );
  });

  const deleteDisputes = () =>
    db.delete(disputeCase).where(like(disputeCase.stripeDisputeId, `dp_ps_${run}_%`));
  const deleteAllocations = async () => {
    const cases = await db
      .select({ id: disputeCase.id })
      .from(disputeCase)
      .where(like(disputeCase.stripeDisputeId, `dp_ps_${run}_%`));
    if (cases.length) {
      await db.delete(disputeAllocation).where(
        inArray(
          disputeAllocation.caseId,
          cases.map((c) => c.id),
        ),
      );
    }
  };
  const disputeLinesPence = async (paymentId: string) => {
    const [row] = await db
      .select({ pence: sql<number>`coalesce(round(sum(${payoutLine.amount}) * 100), 0)::int` })
      .from(payoutLine)
      .where(and(eq(payoutLine.paymentId, paymentId), eq(payoutLine.kind, "dispute")));
    return row?.pence ?? 0;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    chargeRefunds = [];
    await deleteAllocations();
    await deleteDisputes();
    const paymentIds = (
      await db.select({ id: payment.id }).from(payment).where(inArray(payment.lotId, lotIds))
    ).map((r) => r.id);
    if (paymentIds.length) {
      await db.delete(paymentRefund).where(inArray(paymentRefund.paymentId, paymentIds));
      await db.delete(payoutLine).where(inArray(payoutLine.paymentId, paymentIds));
    }
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, lotIds));
    await db.delete(paymentGroup).where(eq(paymentGroup.buyerLegalEntityId, orgId));
    const invoices = await db
      .insert(bidInvoice)
      .values(
        lotIds.map((lotId) => ({
          lotId,
          buyerLegalEntityId: orgId,
          sellerLegalEntityId: sellerId,
          totalPence: 10_000,
          raisedAt: new Date(),
          dueAt: new Date(Date.now() + 7 * 86_400_000),
        })),
      )
      .returning({ id: bidInvoice.id, lotId: bidInvoice.lotId });
    await db.insert(bidInvoiceLine).values(
      invoices.map((invoice) => ({
        invoiceId: invoice.id,
        position: 1,
        kind: "legacy_total",
        label: "Total",
        amountPence: 10_000,
      })),
    );
    const rows = await db
      .insert(payment)
      .values(
        lotIds.map((lotId) => ({
          lotId,
          buyerId: payerId,
          buyerLegalEntityId: orgId,
          sellerLegalEntityId: sellerId,
          amount: "100.00",
          platformFee: "5.00",
          status: "pending" as const,
          invoiceId: invoices.find((i) => i.lotId === lotId)?.id ?? null,
        })),
      )
      .returning({ id: payment.id, lotId: payment.lotId });
    const byLot = (i: number) => rows.find((r) => r.lotId === lotIds[i])?.id as string;
    ids = { a: byLot(0), b: byLot(1), c: byLot(2) };
  });

  afterAll(async () => {
    await deleteAllocations();
    await deleteDisputes();
    const paymentIds = (
      await db.select({ id: payment.id }).from(payment).where(inArray(payment.lotId, lotIds))
    ).map((r) => r.id);
    if (paymentIds.length) {
      await db.delete(paymentRefund).where(inArray(paymentRefund.paymentId, paymentIds));
      await db.delete(payoutLine).where(inArray(payoutLine.paymentId, paymentIds));
    }
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(paymentGroup).where(eq(paymentGroup.buyerLegalEntityId, orgId));
    await db.delete(payout).where(eq(payout.legalEntityId, sellerId));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db
      .delete(processedStripeEvents)
      .where(like(processedStripeEvents.eventId, `evt_ps_${run}_%`));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [orgId, sellerId]));
    await deleteIdentityUserFixtures(db, [payerId]);
  });

  it("lets only one of two concurrent claims over overlapping invoices hold them", async () => {
    const claim = (paymentIds: string[]) =>
      groups.claim({
        buyerLegalEntityId: orgId,
        createdByUserId: payerId,
        currency: "GBP",
        totalAmount: `${paymentIds.length * 100}.00`,
        checkoutRail: "card",
        paymentIds,
        deliveries: [],
      });
    const results = await Promise.all([claim([ids.a, ids.b]), claim([ids.b, ids.c])]);
    expect(results.filter((r) => r.kind === "claimed")).toHaveLength(1);
    expect(results.filter((r) => r.kind === "conflict")).toHaveLength(1);
  });

  it("lets a payment that is still being opened finish: a second start over its invoices waits", async () => {
    const claimed = await groups.claim({
      buyerLegalEntityId: orgId,
      createdByUserId: payerId,
      currency: "GBP",
      totalAmount: "200.00",
      checkoutRail: "card",
      paymentIds: [ids.a, ids.b],
      deliveries: [],
    });
    if (claimed.kind !== "claimed") throw new Error("expected a claim");
    // The group exists but its checkout is not recorded yet, so the first start is mid-way.
    expect((await start([ids.b, ids.c]))._unsafeUnwrapErr()).toBe("in_progress");
    expect(gateway.expireCheckout).not.toHaveBeenCalled();
    expect((await groups.findById(claimed.group.id))?.status).toBe("open");
    expect(await statusOf(ids.b)).toEqual({ status: "pending", group: claimed.group.id });
  });

  it("settles every invoice in one go, and a replayed or repeated notice changes nothing", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const pi = succeeded(groupId);
    const event = eventOf("payment_intent.succeeded", pi);
    expect(await webhooks.handlePaymentIntentSucceeded(event, pi)).toMatchObject({
      processed: true,
      action: "payment_intent_succeeded",
    });
    for (const id of [ids.a, ids.b]) {
      expect(await statusOf(id)).toEqual({ status: "captured", group: groupId });
    }
    expect(await statusOf(ids.c)).toEqual({ status: "pending", group: null });
    expect((await groups.findById(groupId))?.status).toBe("paid");
    expect(receipt.send).toHaveBeenCalledTimes(1);

    expect(await webhooks.handlePaymentIntentSucceeded(event, pi)).toMatchObject({
      reason: "duplicate_event",
    });
    const again = eventOf("payment_intent.succeeded", pi);
    expect(await webhooks.handlePaymentIntentSucceeded(again, pi)).toMatchObject({
      reason: "already_paid",
    });
    expect(receipt.send).toHaveBeenCalledTimes(1);
  });

  it("keeps a group unpaid and opens one finance task when the organisation moves to review before the money lands", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const pi = succeeded(groupId);
    await webhooks.handlePaymentIntentProcessing(eventOf("payment_intent.processing", pi), pi);
    await db.update(legalEntity).set({ status: "under_review" }).where(eq(legalEntity.id, orgId));
    try {
      const result = await webhooks.handlePaymentIntentSucceeded(
        eventOf("payment_intent.succeeded", pi),
        pi,
      );
      expect(result).toMatchObject({
        processed: true,
        action: "skipped",
        reason: "account_organisation_under_review",
      });
      for (const id of [ids.a, ids.b]) {
        expect((await statusOf(id)).status).toBe("authorized");
      }
      expect((await groups.findById(groupId))?.status).toBe("processing");
      const tasks = publish.mock.calls
        .map(([event]) => event)
        .filter((event) => event.eventType === UNAPPLIED_MONEY_EVENT);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].payload).toMatchObject({
        reason: "group_not_settleable",
        paymentGroupId: groupId,
      });
      expect(receipt.send).not.toHaveBeenCalled();
    } finally {
      await db.update(legalEntity).set({ status: "approved" }).where(eq(legalEntity.id, orgId));
    }
  });

  it("applies nothing and raises an alert when the amount does not match", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const pi = succeeded(groupId, { amount: 19_999 });
    expect(
      await webhooks.handlePaymentIntentSucceeded(eventOf("payment_intent.succeeded", pi), pi),
    ).toMatchObject({ reason: "amount_mismatch" });
    expect(await statusOf(ids.a)).toEqual({ status: "pending", group: groupId });
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment_group.settlement_refused" }),
    );
  });

  it("ignores notices that arrive after the group is settled", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const pi = succeeded(groupId);
    await webhooks.handlePaymentIntentSucceeded(eventOf("payment_intent.succeeded", pi), pi);
    // A late "processing" or "cancelled" for the same checkout is no step back.
    expect(
      await webhooks.handlePaymentIntentProcessing(eventOf("payment_intent.processing", pi), pi),
    ).toMatchObject({ reason: "payment_group_not_open" });
    expect(
      await webhooks.handlePaymentIntentCanceled(eventOf("payment_intent.canceled", pi), pi),
    ).toMatchObject({ reason: "payment_group_not_live" });
    expect(await statusOf(ids.a)).toEqual({ status: "captured", group: groupId });
  });

  it("holds the invoices while a bank transfer travels, then settles them", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const pi = succeeded(groupId);
    await webhooks.handlePaymentIntentProcessing(eventOf("payment_intent.processing", pi), pi);
    expect(await statusOf(ids.a)).toEqual({ status: "authorized", group: groupId });
    await webhooks.handlePaymentIntentSucceeded(eventOf("payment_intent.succeeded", pi), pi);
    expect(await statusOf(ids.b)).toEqual({ status: "captured", group: groupId });
  });

  it("hands every invoice back when the checkout expires, once", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const session = {
      id: `cs_${groupId}`,
      metadata: { paymentGroupId: groupId },
    } as unknown as Stripe.Checkout.Session;
    const event = eventOf("checkout.session.expired", session);
    await webhooks.handleCheckoutSessionExpired(event, session);
    for (const id of [ids.a, ids.b]) {
      expect(await statusOf(id)).toEqual({ status: "pending", group: null });
    }
    expect((await groups.findById(groupId))?.status).toBe("cancelled");
    expect(await webhooks.handleCheckoutSessionExpired(event, session)).toMatchObject({
      reason: "duplicate_event",
    });
    // The invoices can be paid again, together or on their own.
    expect((await start([ids.a, ids.b, ids.c])).isOk()).toBe(true);
  });

  it("lets go of the group when one of its invoices is paid on its own first", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    // An earlier single-invoice checkout for a completes after the group took it.
    const single = intent({ amount: 10_000, metadata: { paymentId: ids.a } });
    await webhooks.handlePaymentIntentSucceeded(
      eventOf("payment_intent.succeeded", single),
      single,
    );
    expect((await statusOf(ids.a)).status).toBe("captured");
    expect(await statusOf(ids.b)).toEqual({ status: "pending", group: null });
    expect(gateway.expireCheckout).toHaveBeenCalledWith(`cs_${groupId}`);
    // If the group's checkout still completes, nothing is applied and finance is alerted.
    const pi = succeeded(groupId);
    expect(
      await webhooks.handlePaymentIntentSucceeded(eventOf("payment_intent.succeeded", pi), pi),
    ).toMatchObject({ reason: "group_released" });
    expect(await statusOf(ids.b)).toEqual({ status: "pending", group: null });
  });

  it("keeps a grouped invoice when its own earlier checkout is cancelled", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const single = intent({ metadata: { paymentId: ids.a } });
    expect(
      await webhooks.handlePaymentIntentCanceled(
        eventOf("payment_intent.canceled", single),
        single,
      ),
    ).toMatchObject({ reason: "payment_in_group" });
    expect(await statusOf(ids.a)).toEqual({ status: "pending", group: groupId });
  });

  it("refunds one invoice in part without touching the others", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const pi = succeeded(groupId);
    await webhooks.handlePaymentIntentSucceeded(eventOf("payment_intent.succeeded", pi), pi);
    const charge = {
      id: pi.latest_charge as string,
      payment_intent: pi.id,
      amount: 20_000,
      amount_refunded: 2_500,
      currency: "gbp",
      metadata: {},
    } as unknown as Stripe.Charge;

    chargeRefunds = [{ paymentId: ids.a, amountPence: 2_500 }];
    expect(
      await webhooks.handleChargeRefunded(eventOf("charge.refunded", charge), charge),
    ).toMatchObject({ action: "refund_received" });
    expect(await payouts.sumRefundLineCentsForPayment(ids.a)).toBe(2_500);
    expect(await payouts.sumRefundLineCentsForPayment(ids.b)).toBe(0);
    expect((await paymentRefunds.sumRefundedPence(ids.a)).pence).toBe(2_500);
    expect((await paymentRefunds.sumRefundedPence(ids.b)).pence).toBe(0);
    expect((await statusOf(ids.a)).status).toBe("captured");

    // The rest of a later refunds it in full; b stays paid.
    chargeRefunds = [
      { paymentId: ids.a, amountPence: 2_500 },
      { paymentId: ids.a, amountPence: 7_500 },
      { paymentId: null, amountPence: 300 },
    ];
    await webhooks.handleChargeRefunded(eventOf("charge.refunded", charge), charge);
    expect(await payouts.sumRefundLineCentsForPayment(ids.a)).toBe(10_000);
    expect((await paymentRefunds.sumRefundedPence(ids.a)).pence).toBe(10_000);
    expect((await statusOf(ids.a)).status).toBe("refunded");
    expect((await statusOf(ids.b)).status).toBe("captured");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment_group.refund_unattributed" }),
    );
  });

  it("does not charge the seller back again for a refund the previous release handled", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const pi = succeeded(groupId);
    await webhooks.handlePaymentIntentSucceeded(eventOf("payment_intent.succeeded", pi), pi);
    // The previous release, still running during the rollout, handled the first refund (25.00):
    // it wrote the seller's refund line (as it did before payout too) and nothing in the buyer's
    // record.
    const oldKey = `evt_old_${run}:${ids.a}`;
    const now = new Date();
    const oldPayout = await payouts.create({
      legalEntityId: sellerId,
      periodStart: new Date(now.getTime() - 1),
      periodEnd: now,
      grossAmount: "-25.00",
      platformFee: "0.00",
      stripeFee: "0.00",
      netAmount: "-25.00",
      currency: "GBP",
    });
    await payouts.insertLine({
      payoutId: oldPayout.id,
      paymentId: ids.a,
      amount: "-25.00",
      kind: "refund",
      createdByUserId: null,
      note: "Refund: previous release",
      sourceEventId: oldKey,
    });
    expect((await paymentRefunds.sumRefundedPence(ids.a)).pence).toBe(0);
    const charge = {
      id: pi.latest_charge as string,
      payment_intent: pi.id,
      amount: 20_000,
      amount_refunded: 2_500,
      currency: "gbp",
      metadata: {},
    } as unknown as Stripe.Charge;

    // The new release sees the same refund again (another event): nothing new for the seller.
    chargeRefunds = [{ paymentId: ids.a, amountPence: 2_500 }];
    const gap = await webhooks.handleChargeRefunded(eventOf("charge.refunded", charge), charge);
    expect(gap).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect(await payouts.sumRefundLineCentsForPayment(ids.a)).toBe(2_500);
    // The buyer's record now holds that refund once, as a top-up from the payout ledger.
    expect((await paymentRefunds.sumRefundedPence(ids.a)).pence).toBe(2_500);
    const keys = await db
      .select({ key: paymentRefund.idempotencyKey })
      .from(paymentRefund)
      .where(eq(paymentRefund.paymentId, ids.a));
    expect(keys).toEqual([{ key: `payout_ledger_topup:${ids.a}:2500` }]);

    // The data step run after the release changes nothing.
    await db.execute(sql`SELECT payment_refund_backfill_from_payout_lines()`);
    expect((await paymentRefunds.sumRefundedPence(ids.a)).pence).toBe(2_500);

    // A later refund moves both by what is new only.
    chargeRefunds = [
      { paymentId: ids.a, amountPence: 2_500 },
      { paymentId: ids.a, amountPence: 7_500 },
    ];
    await webhooks.handleChargeRefunded(eventOf("charge.refunded", charge), charge);
    expect(await payouts.sumRefundLineCentsForPayment(ids.a)).toBe(10_000);
    expect((await paymentRefunds.sumRefundedPence(ids.a)).pence).toBe(10_000);
  });

  it("keeps a refund above the invoice on the buyer's record while the seller is reversed no more than the invoice", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const pi = succeeded(groupId);
    await webhooks.handlePaymentIntentSucceeded(eventOf("payment_intent.succeeded", pi), pi);
    const charge = {
      id: pi.latest_charge as string,
      payment_intent: pi.id,
      amount: 20_000,
      amount_refunded: 13_000,
      currency: "gbp",
      metadata: {},
    } as unknown as Stripe.Charge;

    chargeRefunds = [
      { paymentId: ids.a, amountPence: 10_000 },
      { paymentId: ids.a, amountPence: 3_000 },
    ];
    await webhooks.handleChargeRefunded(eventOf("charge.refunded", charge), charge);
    expect((await paymentRefunds.sumRefundedPence(ids.a)).pence).toBe(13_000);
    // The sale is on no payout, so the seller is charged nothing for it and their side counts
    // every buyer refund as dealt with.
    expect(await payouts.sumRefundLineCentsForPayment(ids.a)).toBe(13_000);
    expect(
      await db
        .select({ id: payoutLine.id })
        .from(payoutLine)
        .where(and(eq(payoutLine.paymentId, ids.a), eq(payoutLine.kind, "refund"))),
    ).toEqual([]);
    expect((await statusOf(ids.a)).status).toBe("refunded");

    // The same refunds reported again change nothing.
    const again = await webhooks.handleChargeRefunded(eventOf("charge.refunded", charge), charge);
    expect(again).toMatchObject({ action: "skipped", reason: "no_new_refund_amount" });
    expect((await paymentRefunds.sumRefundedPence(ids.a)).pence).toBe(13_000);
  });

  it("holds a dispute on a combined payment for allocation, then moves each seller's share once", async () => {
    const groupId = await startOk([ids.a, ids.b]);
    const pi = succeeded(groupId);
    await webhooks.handlePaymentIntentSucceeded(eventOf("payment_intent.succeeded", pi), pi);
    // The whole £200 charge is disputed: before, each invoice was clawed back in full at once.
    const dispute = {
      id: `dp_ps_${run}_whole`,
      object: "dispute",
      charge: pi.latest_charge as string,
      payment_intent: pi.id,
      amount: 20_000,
      currency: "gbp",
      reason: "fraudulent",
      status: "needs_response",
      created: 1_798_000_000,
      evidence_details: { due_by: 1_798_900_000, submission_count: 0 },
    } as unknown as Stripe.Dispute;

    expect(
      await webhooks.handleDisputeCreated(eventOf("charge.dispute.created", dispute), dispute),
    ).toMatchObject({ action: "dispute_created", reason: "needs_allocation" });
    expect(
      await webhooks.handleDisputeFundsWithdrawn(
        eventOf("charge.dispute.funds_withdrawn", dispute),
        dispute,
      ),
    ).toMatchObject({ reason: "needs_allocation" });
    expect(await disputeLinesPence(ids.a)).toBe(0);
    expect(await disputeLinesPence(ids.b)).toBe(0);

    const [record] = await db
      .select()
      .from(disputeCase)
      .where(eq(disputeCase.stripeDisputeId, dispute.id));
    if (!record) throw new Error("expected a dispute case");
    expect(record.allocationState).toBe("needs_allocation");
    expect(await disputeCases.countAwaitingAllocation()).toBeGreaterThanOrEqual(1);

    // Finance puts £100 on each invoice; each seller carries their net share (a £5 fee each).
    const saved = await allocation.allocate({
      caseId: record.id,
      expectedVersion: record.version,
      actorUserId: payerId,
      lines: [
        { paymentId: ids.a, amountPence: 10_000 },
        { paymentId: ids.b, amountPence: 10_000 },
      ],
    });
    expect(saved.isOk()).toBe(true);
    expect(await disputeLinesPence(ids.a)).toBe(-9_500);
    expect(await disputeLinesPence(ids.b)).toBe(-9_500);

    // A stale or repeated save changes nothing.
    const again = await allocation.allocate({
      caseId: record.id,
      expectedVersion: record.version,
      actorUserId: payerId,
      lines: [{ paymentId: ids.a, amountPence: 20_000 }],
    });
    expect(again._unsafeUnwrapErr()).toBe("version_conflict");

    // Won: each line is reversed once, even with both Stripe notices.
    const won = { ...dispute, status: "won" } as Stripe.Dispute;
    await webhooks.handleDisputeFundsReinstated(
      eventOf("charge.dispute.funds_reinstated", won),
      won,
    );
    await webhooks.handleDisputeClosed(eventOf("charge.dispute.closed", won), won);
    expect(await disputeLinesPence(ids.a)).toBe(0);
    expect(await disputeLinesPence(ids.b)).toBe(0);
  });

  describe("a bank transfer that arrives in part", () => {
    const partial = (groupId: string, received: number, at: number, id?: string) => {
      const pi = intent({
        amount: 20_000,
        amount_received: received,
        metadata: { paymentGroupId: groupId },
      });
      const event = { ...eventOf("payment_intent.partially_funded", pi, id), created: at };
      return webhooks.handlePaymentIntentPartiallyFunded(event, pi);
    };
    const stored = async (groupId: string) => {
      const row = await groups.findById(groupId);
      return { received: row?.amountReceived, at: row?.receivedEventAt?.getTime() ?? null };
    };

    it("holds the invoices and stores what has arrived, and only ever raises it", async () => {
      const groupId = await startOk([ids.a, ids.b]);
      await partial(groupId, 6_000, 1_793_000_100);
      expect(await statusOf(ids.a)).toEqual({ status: "authorized", group: groupId });
      expect(await stored(groupId)).toEqual({ received: "60.00", at: 1_793_000_100_000 });

      await partial(groupId, 12_000, 1_793_000_200);
      expect((await stored(groupId)).received).toBe("120.00");
      // Still held: nothing is paid until all of it is in.
      expect(await statusOf(ids.b)).toEqual({ status: "authorized", group: groupId });
    });

    it("ignores an older event delivered late, and a repeat of one it has seen", async () => {
      const groupId = await startOk([ids.a, ids.b]);
      await partial(groupId, 12_000, 1_793_000_200, `evt_ps_${run}_newer`);
      await partial(groupId, 6_000, 1_793_000_100, `evt_ps_${run}_older`);
      expect(await stored(groupId)).toEqual({ received: "120.00", at: 1_793_000_200_000 });
      const again = await partial(groupId, 12_000, 1_793_000_200, `evt_ps_${run}_newer`);
      expect(again).toMatchObject({ reason: "duplicate_event" });
      expect((await stored(groupId)).received).toBe("120.00");
    });

    it("never stores more than the group's total", async () => {
      const groupId = await startOk([ids.a, ids.b]);
      await partial(groupId, 99_999, 1_793_000_100);
      expect((await stored(groupId)).received).toBe("200.00");
    });

    it("stores nothing for a group that was already released", async () => {
      const groupId = await startOk([ids.a, ids.b]);
      const session = {
        id: `cs_${groupId}`,
        metadata: { paymentGroupId: groupId },
      } as unknown as Stripe.Checkout.Session;
      await webhooks.handleCheckoutSessionExpired(
        eventOf("checkout.session.expired", session),
        session,
      );
      await partial(groupId, 6_000, 1_793_000_100);
      expect((await stored(groupId)).received).toBe("0.00");
      expect(await statusOf(ids.a)).toEqual({ status: "pending", group: null });
    });
  });

  describe("the cut-off for a payment that is still being opened", () => {
    it("lets go of a group whose start failed long ago and never got a checkout", async () => {
      const claimed = await groups.claim({
        buyerLegalEntityId: orgId,
        createdByUserId: payerId,
        currency: "GBP",
        totalAmount: "200.00",
        checkoutRail: "card",
        paymentIds: [ids.a, ids.b],
        deliveries: [],
      });
      if (claimed.kind !== "claimed") throw new Error("expected a claim");
      await db
        .update(paymentGroup)
        .set({ createdAt: new Date(Date.now() - 10 * 60_000) })
        .where(eq(paymentGroup.id, claimed.group.id));
      expect((await start([ids.a, ids.b])).isOk()).toBe(true);
      expect((await groups.findById(claimed.group.id))?.status).toBe("cancelled");
    });

    describe("a slow start that records its checkout just before the release", () => {
      const slowStart = async (statusAfterExpire: "complete" | "expired") => {
        const claimed = await groups.claim({
          buyerLegalEntityId: orgId,
          createdByUserId: payerId,
          currency: "GBP",
          totalAmount: "200.00",
          checkoutRail: "card",
          paymentIds: [ids.a, ids.b],
          deliveries: [],
        });
        if (claimed.kind !== "claimed") throw new Error("expected a claim");
        await db
          .update(paymentGroup)
          .set({ createdAt: new Date(Date.now() - 10 * 60_000) })
          .where(eq(paymentGroup.id, claimed.group.id));
        // The second start reads the group before the slow start commits its checkout.
        const stale = await groups.findLiveByPaymentIds([ids.a, ids.b]);
        const spy = vi.spyOn(groups, "findLiveByPaymentIds").mockImplementationOnce(async () => {
          await groups.recordCheckout(claimed.group.id, {
            sessionId: "cs_slow",
            paymentIntentId: null,
          });
          return stale;
        });
        gateway.checkoutStatus.mockResolvedValue(statusAfterExpire);
        try {
          return { groupId: claimed.group.id, result: await start([ids.a, ids.b]) };
        } finally {
          spy.mockRestore();
          gateway.checkoutStatus.mockResolvedValue("expired");
        }
      };

      it("ends it through the provider and leaves it alone when the payer had finished it", async () => {
        const { groupId, result } = await slowStart("complete");
        expect(result._unsafeUnwrapErr()).toBe("in_progress");
        expect(gateway.expireCheckout).toHaveBeenCalledWith("cs_slow");
        expect((await groups.findById(groupId))?.status).toBe("open");
      });

      it("releases it only after the provider says it can no longer be paid", async () => {
        const { groupId, result } = await slowStart("expired");
        expect(result.isOk()).toBe(true);
        expect(gateway.expireCheckout).toHaveBeenCalledWith("cs_slow");
        expect((await groups.findById(groupId))?.status).toBe("cancelled");
      });
    });

    it("does not record a checkout against a group that was let go meanwhile", async () => {
      const groupId = await startOk([ids.a, ids.b]);
      await db.transaction(async (tx) => {
        await groups.transitionInTransaction(tx, groupId, ["open"], "cancelled");
      });
      expect(
        await groups.recordCheckout(groupId, { sessionId: "cs_late", paymentIntentId: null }),
      ).toBe(false);
      expect((await groups.findById(groupId))?.stripeCheckoutSessionId).not.toBe("cs_late");
    });
  });

  describe("starting again after leaving a checkout", () => {
    it("ends the abandoned checkout and opens a new one by the chosen method", async () => {
      const first = await startOk([ids.a, ids.b]);
      gateway.checkoutStatus.mockResolvedValue("expired");
      const second = await start([ids.a, ids.b]);
      expect(second.isOk()).toBe(true);
      expect(gateway.expireCheckout).toHaveBeenCalledWith(`cs_${first}`);
      expect((await groups.findById(first))?.status).toBe("cancelled");
      const live = await groups.findLiveByPaymentIds([ids.a, ids.b]);
      expect(live.map((g) => g.id)).toEqual([second._unsafeUnwrap().paymentGroupId]);
    });

    it("opens nothing while the earlier checkout was finished by the payer", async () => {
      const first = await startOk([ids.a, ids.b]);
      gateway.checkoutStatus.mockResolvedValue("complete");
      const second = await start([ids.a, ids.b]);
      expect(second._unsafeUnwrapErr()).toBe("in_progress");
      expect((await groups.findById(first))?.status).toBe("open");
      expect(await statusOf(ids.a)).toEqual({ status: "pending", group: first });
      gateway.checkoutStatus.mockResolvedValue("expired");
    });
  });

  describe("recorded provider payloads for the three flows", () => {
    const withCreated = (event: Stripe.Event, created: number) =>
      ({ ...event, created }) as Stripe.Event;

    it("card success: a submitted checkout is settled by the succeeded notice", async () => {
      const groupId = await startOk([ids.a, ids.b]);
      const pi = succeeded(groupId, { status: "succeeded", amount_received: 20_000 });
      await webhooks.handlePaymentIntentSucceeded(eventOf("payment_intent.succeeded", pi), pi);
      expect((await groups.findById(groupId))?.status).toBe("paid");
      expect(await statusOf(ids.a)).toEqual({ status: "captured", group: groupId });
    });

    it("3D Secure failure: the group stays open, the invoices stay held, and a retry replaces it", async () => {
      const groupId = await startOk([ids.a, ids.b]);
      const failed = succeeded(groupId, {
        status: "requires_payment_method",
        last_payment_error: { code: "payment_intent_authentication_failure", type: "card_error" },
      } as Partial<Stripe.PaymentIntent>);
      expect(
        await webhooks.handlePaymentIntentFailed(
          eventOf("payment_intent.payment_failed", failed),
          failed,
        ),
      ).toMatchObject({ reason: "payment_group_attempt_failed" });
      expect((await groups.findById(groupId))?.status).toBe("open");
      // The person comes back and tries again: the unfinished checkout is ended, a new one opens.
      gateway.checkoutStatus.mockResolvedValue("expired");
      const retry = await start([ids.a, ids.b]);
      expect(retry.isOk()).toBe(true);
      expect((await groups.findById(groupId))?.status).toBe("cancelled");
    });

    it("transfer part-funded then funded: held, progress stored, then settled in one", async () => {
      const groupId = await startOk([ids.a, ids.b]);
      const part = succeeded(groupId, {
        status: "requires_action",
        amount_received: 0,
        next_action: {
          type: "display_bank_transfer_instructions",
          display_bank_transfer_instructions: {
            amount_remaining: 14_000,
            currency: "gbp",
            financial_addresses: [],
            hosted_instructions_url: "https://payments.stripe.com/instructions/test",
            reference: "LAXB7KQ2R9",
            type: "gb_bank_transfer",
          },
        },
      } as unknown as Partial<Stripe.PaymentIntent>);
      await webhooks.handlePaymentIntentPartiallyFunded(
        withCreated(eventOf("payment_intent.partially_funded", part), 1_793_000_100),
        part,
      );
      const held = await groups.findById(groupId);
      expect(held?.status).toBe("processing");
      expect(held?.amountReceived).toBe("60.00");
      expect(await statusOf(ids.a)).toEqual({ status: "authorized", group: groupId });

      const funded = succeeded(groupId, { status: "succeeded", amount_received: 20_000 });
      await webhooks.handlePaymentIntentSucceeded(
        eventOf("payment_intent.succeeded", funded),
        funded,
      );
      expect((await groups.findById(groupId))?.status).toBe("paid");
      expect(await statusOf(ids.b)).toEqual({ status: "captured", group: groupId });
    });
  });
});
