import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  disputeAllocation,
  disputeCase,
  disputeCaseCandidate,
  domainEvent,
  legalEntity,
  lot,
  payment,
  payout,
  payoutLine,
  processedStripeEvents,
} from "@auction/db/schema";
import {
  DrizzleDisputeCaseRepository,
  DrizzleDisputePaymentReader,
  DrizzlePaymentRepository,
  DrizzlePaymentWebhookLookupReader,
  DrizzlePayoutRepository,
} from "@auction/persistence/repositories";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { tryClaimProcessedStripeEvent } from "../../lib/stripe-processed-event.js";
import { dispatchStripePaymentEvent } from "../../routes/webhooks/stripe-payment-event-registry.js";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { STRIPE_DISPUTE_FIXTURE } from "../../test/stripe-dispute-fixture.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { PayoutAdjustmentService } from "../payout/payout-adjustment.service.js";
import { StripePaymentWebhookService } from "../stripe-payment-webhook.service.js";
import { PAYMENT_WEBHOOK_EVENT_SOURCE } from "../stripe-webhook/payment-webhook-types.js";
import { DisputeCaseRecorder } from "./dispute-case-recorder.js";
import { DisputeLineEffects } from "./dispute-line-effects.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("dispute webhooks record dispute cases (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const runner = transactionRunnerFromDb(db);
  const payouts = new DrizzlePayoutRepository(db);
  const payoutAdjustments = new PayoutAdjustmentService(
    runner,
    payouts,
    (_root, tx) => new DrizzlePayoutRepository(tx),
  );
  const publish = vi.fn().mockResolvedValue(undefined);
  const events = mockDomainEventSink(publish);
  const cases = new DrizzleDisputeCaseRepository(db);
  const recorder = new DisputeCaseRecorder({
    transactionRunner: runner,
    claims: {
      claim: async (tx, eventId) =>
        (await tryClaimProcessedStripeEvent(tx, eventId, PAYMENT_WEBHOOK_EVENT_SOURCE)).claimed,
    },
    cases,
    payments: new DrizzleDisputePaymentReader(),
    effects: new DisputeLineEffects({ cases, payoutAdjustments, events }),
    events,
  });
  const webhooks = new StripePaymentWebhookService(
    runner,
    new DrizzlePaymentWebhookLookupReader(db),
    new DrizzlePaymentRepository(db),
    payouts,
    payoutAdjustments,
    {} as never,
    events,
    recorder,
  );

  const run = randomUUID().slice(0, 8);
  const buyerUserId = `dc-buyer-${run}`;
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const lotId = randomUUID();
  let paymentId: string;
  const chargeId = `ch_dc_${run}`;
  let seq = 0;

  /** Stripe's event envelope around a dispute, as the webhook route hands it over. */
  const deliver = (type: string, dispute: Stripe.Dispute, created = 1_798_000_000 + ++seq) =>
    dispatchStripePaymentEvent(webhooks, {
      id: `evt_dc_${run}_${randomUUID()}`,
      object: "event",
      type,
      created,
      data: { object: dispute },
    } as unknown as Stripe.Event);
  const disputeOf = (suffix: string, over: Partial<Stripe.Dispute> = {}) =>
    ({
      ...STRIPE_DISPUTE_FIXTURE,
      id: `dp_dc_${run}_${suffix}`,
      charge: chargeId,
      payment_intent: null,
      amount: 10_000,
      ...over,
    }) as Stripe.Dispute;
  const caseOf = async (stripeDisputeId: string) => {
    const [row] = await db
      .select()
      .from(disputeCase)
      .where(eq(disputeCase.stripeDisputeId, stripeDisputeId));
    return row;
  };
  const disputeLinesPence = async () => {
    const [row] = await db
      .select({ pence: sql<number>`coalesce(round(sum(${payoutLine.amount}) * 100), 0)::int` })
      .from(payoutLine)
      .where(and(eq(payoutLine.paymentId, paymentId), eq(payoutLine.kind, "dispute")));
    return row?.pence ?? 0;
  };
  const cleanDisputes = async () => {
    const ours = await db
      .select({ id: disputeCase.id })
      .from(disputeCase)
      .where(like(disputeCase.stripeDisputeId, `dp_dc_${run}_%`));
    const ids = ours.map((r) => r.id);
    if (ids.length) {
      await db.delete(disputeAllocation).where(inArray(disputeAllocation.caseId, ids));
      await db.delete(disputeCaseCandidate).where(inArray(disputeCaseCandidate.caseId, ids));
      await db.delete(disputeCase).where(inArray(disputeCase.id, ids));
    }
    await db.delete(payoutLine).where(eq(payoutLine.paymentId, paymentId));
    await db.delete(payout).where(eq(payout.legalEntityId, sellerId));
    await db.delete(domainEvent).where(eq(domainEvent.aggregateId, paymentId));
  };

  beforeAll(async () => {
    const now = new Date();
    await seedIdentityUserFixtures(db, [
      { id: buyerUserId, name: "Buyer", email: `${buyerUserId}@integration.test` },
    ]);
    await db.insert(legalEntity).values([
      {
        id: buyerId,
        displayName: "Buyer",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: buyerUserId,
        status: "approved",
      },
      {
        id: sellerId,
        displayName: "Seller",
        kind: "individual",
        subkind: "private_collector",
        createdByUserId: buyerUserId,
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
      winnerId: buyerUserId,
      buyerLegalEntityId: buyerId,
    });
    const [row] = await db
      .insert(payment)
      .values({
        lotId,
        buyerId: buyerUserId,
        buyerLegalEntityId: buyerId,
        sellerLegalEntityId: sellerId,
        amount: "100.00",
        platformFee: "5.00",
        status: "captured",
        stripeChargeId: chargeId,
      })
      .returning({ id: payment.id });
    paymentId = row?.id as string;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await cleanDisputes();
  });

  afterAll(async () => {
    await cleanDisputes();
    await db.delete(payment).where(eq(payment.id, paymentId));
    await db.delete(lot).where(eq(lot.id, lotId));
    await db
      .delete(processedStripeEvents)
      .where(like(processedStripeEvents.eventId, `evt_dc_${run}_%`));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerId, sellerId]));
    await deleteIdentityUserFixtures(db, [buyerUserId]);
  });

  it("records a dispute on a charge no payment matches, with its deadline, for allocation", async () => {
    const dispute = disputeOf("unmatched", { charge: `ch_dc_${run}_unknown` });
    expect(await deliver("charge.dispute.created", dispute)).toEqual({
      processed: true,
      action: "dispute_created",
      reason: "needs_allocation",
    });
    expect(await caseOf(dispute.id)).toMatchObject({
      stripeChargeId: `ch_dc_${run}_unknown`,
      amountPence: 10_000,
      currency: "gbp",
      reason: "fraudulent",
      networkReasonCode: "10.4",
      cardBrand: "visa",
      status: "needs_response",
      dueBy: new Date(1_798_950_000 * 1000),
      chargeRefundable: true,
      allocationState: "needs_allocation",
    });
    const before = await cases.countAwaitingAllocation();
    expect(before).toBeGreaterThanOrEqual(1);

    // Lost without anyone allocating it: still waiting, and still counted.
    await deliver("charge.dispute.funds_withdrawn", dispute);
    await deliver("charge.dispute.closed", { ...dispute, status: "lost" } as Stripe.Dispute);
    expect(await cases.countAwaitingAllocation()).toBe(before);
    expect(await disputeLinesPence()).toBe(0);
    // Won leaves the queue: there is nothing left to put on an invoice.
    const won = disputeOf("unmatched-won", { charge: `ch_dc_${run}_unknown2` });
    await deliver("charge.dispute.created", won);
    await deliver("charge.dispute.closed", { ...won, status: "won" } as Stripe.Dispute);
    expect(await cases.countAwaitingAllocation()).toBe(before);
  });

  it("records one case when two notices about a new dispute arrive together", async () => {
    const dispute = disputeOf("race");
    const results = await Promise.all([
      deliver("charge.dispute.created", dispute),
      deliver("charge.dispute.funds_withdrawn", dispute),
    ]);
    expect(results.every((r) => r.processed)).toBe(true);
    const rows = await db
      .select({ id: disputeCase.id })
      .from(disputeCase)
      .where(eq(disputeCase.stripeDisputeId, dispute.id));
    expect(rows).toHaveLength(1);
    const lines = await db
      .select()
      .from(disputeAllocation)
      .where(eq(disputeAllocation.caseId, rows[0]?.id as string));
    expect(lines).toHaveLength(1);
    expect(await disputeLinesPence()).toBe(-9_500);
  });

  it("claws back a single invoice's seller net share once and reverses it once when won", async () => {
    const dispute = disputeOf("single");
    await deliver("charge.dispute.created", dispute);
    const record = await caseOf(dispute.id);
    expect(record?.allocationState).toBe("allocated");

    await deliver("charge.dispute.funds_withdrawn", dispute);
    await deliver("charge.dispute.funds_withdrawn", dispute);
    expect(await disputeLinesPence()).toBe(-9_500);

    await deliver("charge.dispute.updated", {
      ...dispute,
      status: "under_review",
      evidence_details: { ...STRIPE_DISPUTE_FIXTURE.evidence_details, submission_count: 1 },
    } as Stripe.Dispute);
    expect(await caseOf(dispute.id)).toMatchObject({
      status: "under_review",
      evidenceSubmitted: true,
    });

    const won = { ...dispute, status: "won" } as Stripe.Dispute;
    await deliver("charge.dispute.funds_reinstated", won);
    await deliver("charge.dispute.closed", won);
    expect(await disputeLinesPence()).toBe(0);
    const closed = await caseOf(dispute.id);
    expect(closed?.status).toBe("won");
    expect(closed?.closedAt).not.toBeNull();
    expect(closed?.fundsReinstatedAt).not.toBeNull();
  });

  it("ignores an older copy of the dispute that arrives after a newer one", async () => {
    const dispute = disputeOf("order");
    await deliver(
      "charge.dispute.closed",
      { ...dispute, status: "lost" } as Stripe.Dispute,
      1_798_500_000,
    );
    await deliver(
      "charge.dispute.updated",
      { ...dispute, status: "under_review" } as Stripe.Dispute,
      1_798_400_000,
    );
    expect((await caseOf(dispute.id))?.status).toBe("lost");
  });

  it("picks up a dispute the previous release clawed back, and reverses it once on a win", async () => {
    const dispute = disputeOf("legacy");
    // What the previous release left: the payment events and its clawback line.
    await db.insert(domainEvent).values(
      ["payment.dispute_opened", "payment.dispute_funds_withdrawn"].map((eventType) => ({
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType,
        producer: "api",
        payload: {
          stripeDisputeId: dispute.id,
          stripeChargeId: chargeId,
          amountCents: 10_000,
          currency: "gbp",
          sellerLegalEntityId: sellerId,
        },
      })),
    );
    await payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
      legalEntityId: sellerId,
      paymentId,
      amount: "-100.00",
      kind: "dispute",
      sourceEventId: `evt_dc_${run}_legacy_withdrawn`,
      note: "Dispute funds withdrawn",
    });

    await deliver("charge.dispute.closed", { ...dispute, status: "won" } as Stripe.Dispute);
    expect(await disputeLinesPence()).toBe(0);
    expect((await caseOf(dispute.id))?.allocationState).toBe("allocated");
  });
});
