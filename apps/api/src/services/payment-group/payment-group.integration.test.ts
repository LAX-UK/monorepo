import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  legalEntity,
  lot,
  payment,
  paymentGroup,
  payout,
  payoutLine,
  processedStripeEvents,
} from "@auction/db/schema";
import {
  DrizzlePaymentGroupRepository,
  DrizzlePaymentRepository,
  DrizzlePaymentWebhookLookupReader,
  DrizzlePayoutRepository,
} from "@auction/persistence/repositories";
import { eq, inArray, like } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { PaymentCaptureService } from "../payment/payment-capture.service.js";
import { PayoutAdjustmentService } from "../payout/payout-adjustment.service.js";
import { StripePaymentWebhookService } from "../stripe-payment-webhook.service.js";
import { PAYMENT_WEBHOOK_EVENT_SOURCE } from "../stripe-webhook/payment-webhook-types.js";
import { PaymentGroupChargeEvents } from "./payment-group-charge-events.js";
import { PaymentGroupCheckoutService } from "./payment-group-checkout.service.js";
import type { GroupChargeRefund, IPaymentGroupGateway } from "./payment-group-ports.js";
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
  const gateway: IPaymentGroupGateway & { createCheckout: ReturnType<typeof vi.fn> } = {
    isConfigured: () => true,
    createCheckout: vi.fn(async (input: { paymentGroupId: string }) => ({
      sessionId: `cs_${input.paymentGroupId}`,
      url: `https://checkout.example/${input.paymentGroupId}`,
      paymentIntentId: `pi_${input.paymentGroupId}`,
    })),
    expireCheckout: vi.fn().mockResolvedValue(undefined),
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
  });
  const checkout = new PaymentGroupCheckoutService({
    groups,
    gateway,
    stripeCustomers: { isConfigured: () => true, findOrCreateForLegalEntity: async () => "cus_1" },
    users: {
      findById: async (id: string) => ({ id, email: `${id}@integration.test`, name: "Payer" }),
    } as never,
    singleCheckouts: { revoke: vi.fn().mockResolvedValue(undefined) },
    accounting: { ensureInvoices: async () => true },
    settlement,
    events,
    webOrigin: "https://lax.example",
  });
  const chargeEvents = new PaymentGroupChargeEvents({
    transactionRunner: runner,
    groups,
    gateway,
    payments,
    payoutAdjustments,
    refundedCentsSoFar: (tx, paymentId) =>
      new DrizzlePayoutRepository(tx).sumRefundLineCentsForPayment(paymentId),
    events,
    claims,
  });
  const webhooks = new StripePaymentWebhookService(
    runner,
    new DrizzlePaymentWebhookLookupReader(db),
    payments,
    payouts,
    payoutAdjustments,
    capture,
    events,
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

  beforeEach(async () => {
    vi.clearAllMocks();
    chargeRefunds = [];
    const paymentIds = (
      await db.select({ id: payment.id }).from(payment).where(inArray(payment.lotId, lotIds))
    ).map((r) => r.id);
    if (paymentIds.length) {
      await db.delete(payoutLine).where(inArray(payoutLine.paymentId, paymentIds));
    }
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(paymentGroup).where(eq(paymentGroup.buyerLegalEntityId, orgId));
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
        })),
      )
      .returning({ id: payment.id, lotId: payment.lotId });
    const byLot = (i: number) => rows.find((r) => r.lotId === lotIds[i])?.id as string;
    ids = { a: byLot(0), b: byLot(1), c: byLot(2) };
  });

  afterAll(async () => {
    const paymentIds = (
      await db.select({ id: payment.id }).from(payment).where(inArray(payment.lotId, lotIds))
    ).map((r) => r.id);
    if (paymentIds.length) {
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

  it("lets only one of two concurrent payments over overlapping invoices hold them", async () => {
    const [first, second] = await Promise.all([start([ids.a, ids.b]), start([ids.b, ids.c])]);
    const results = [first, second];
    expect(results.filter((r) => r.isOk())).toHaveLength(1);
    expect(results.filter((r) => r.isErr() && r.error === "conflict")).toHaveLength(1);
    // Only the winner's checkout was opened.
    expect(gateway.createCheckout).toHaveBeenCalledTimes(1);
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
    expect((await statusOf(ids.a)).status).toBe("captured");

    // The rest of a later refunds it in full; b stays paid.
    chargeRefunds = [
      { paymentId: ids.a, amountPence: 2_500 },
      { paymentId: ids.a, amountPence: 7_500 },
      { paymentId: null, amountPence: 300 },
    ];
    await webhooks.handleChargeRefunded(eventOf("charge.refunded", charge), charge);
    expect(await payouts.sumRefundLineCentsForPayment(ids.a)).toBe(10_000);
    expect((await statusOf(ids.a)).status).toBe("refunded");
    expect((await statusOf(ids.b)).status).toBe("captured");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment_group.refund_unattributed" }),
    );
  });
});
