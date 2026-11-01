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
} from "@auction/db/schema";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { backfillDisputeCases } from "./dispute-case-backfill.runner.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("backfilling dispute cases from domain events (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const run = randomUUID().slice(0, 8);
  const userId = `bf-user-${run}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const lotId = randomUUID();
  const matchedDispute = `dp_bf_${run}_matched`;
  const unmatchedDispute = `dp_bf_${run}_unmatched`;
  let paymentId = "";

  const event = (
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: object,
  ) => ({
    aggregateType,
    aggregateId,
    eventType,
    payload,
    producer: "test",
  });
  const mine = async () =>
    db
      .select()
      .from(disputeCase)
      .where(like(disputeCase.stripeDisputeId, `dp_bf_${run}_%`));

  beforeAll(async () => {
    const now = new Date();
    await seedIdentityUserFixtures(db, [{ id: userId, name: "Buyer", email: `${userId}@it.test` }]);
    const entity = (id: string, displayName: string) => ({
      id,
      displayName,
      kind: "individual" as const,
      subkind: "private_collector" as const,
      createdByUserId: userId,
      status: "approved" as const,
    });
    await db
      .insert(legalEntity)
      .values([entity(buyerEntity, "Buyer"), entity(sellerEntity, "Seller")]);
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
      sellerLegalEntityId: sellerEntity,
      winnerId: userId,
      buyerLegalEntityId: buyerEntity,
    });
    const [row] = await db
      .insert(payment)
      .values({
        lotId,
        buyerId: userId,
        buyerLegalEntityId: buyerEntity,
        sellerLegalEntityId: sellerEntity,
        amount: "100.00",
        platformFee: "5.00",
        status: "captured",
        stripeChargeId: `ch_bf_${run}`,
      })
      .returning({ id: payment.id });
    paymentId = row?.id as string;
    await db.insert(domainEvent).values([
      event("payment", paymentId, "payment.dispute_opened", {
        stripeDisputeId: matchedDispute,
        stripeChargeId: `ch_bf_${run}`,
        amountCents: 10_000,
        currency: "gbp",
        reason: "fraudulent",
      }),
      event("payment", paymentId, "payment.dispute_funds_withdrawn", {
        stripeDisputeId: matchedDispute,
        amountCents: 10_000,
      }),
      event("stripe_dispute", unmatchedDispute, "payment.dispute_unmatched", {
        stripeDisputeId: unmatchedDispute,
        stripeChargeId: `ch_bf_${run}_none`,
        amountCents: 2_500,
        currency: "gbp",
        reason: "general",
        evidenceDueAt: "2026-11-12T23:59:00.000Z",
      }),
    ]);
  });

  afterAll(async () => {
    const ids = (await mine()).map((c) => c.id);
    if (ids.length) {
      await db.delete(disputeAllocation).where(inArray(disputeAllocation.caseId, ids));
      await db.delete(disputeCaseCandidate).where(inArray(disputeCaseCandidate.caseId, ids));
      await db.delete(disputeCase).where(inArray(disputeCase.id, ids));
    }
    await db.delete(domainEvent).where(eq(domainEvent.producer, "test"));
    await db.delete(payment).where(eq(payment.id, paymentId));
    await db.delete(lot).where(eq(lot.id, lotId));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerEntity, sellerEntity]));
    await deleteIdentityUserFixtures(db, [userId]);
  });

  it("writes nothing in a dry run", async () => {
    const report = await backfillDisputeCases(db, { apply: false });
    expect(report.created).toBe(0);
    expect(report.plan.cases.map((c) => c.stripeDisputeId)).toEqual(
      expect.arrayContaining([matchedDispute, unmatchedDispute]),
    );
    expect(await mine()).toEqual([]);
  });

  it("creates the cases when applied, and a second run changes nothing", async () => {
    await backfillDisputeCases(db, { apply: true });
    const cases = await mine();
    expect(cases.map((c) => c.stripeDisputeId).sort()).toEqual([matchedDispute, unmatchedDispute]);
    const matched = cases.find((c) => c.stripeDisputeId === matchedDispute);
    expect(matched).toMatchObject({
      status: "under_review",
      allocationState: "allocated",
      amountPence: 10_000,
      cardBrand: null,
      networkReasonCode: null,
    });
    const unmatched = cases.find((c) => c.stripeDisputeId === unmatchedDispute);
    expect(unmatched).toMatchObject({
      allocationState: "needs_allocation",
      dueBy: new Date("2026-11-12T23:59:00.000Z"),
    });
    const lines = await db
      .select()
      .from(disputeAllocation)
      .where(eq(disputeAllocation.caseId, matched?.id as string));
    expect(lines).toMatchObject([{ source: "legacy", clawback: "withdrawn", amountPence: 10_000 }]);

    const again = await backfillDisputeCases(db, { apply: true });
    expect(again.created).toBe(0);
    expect(again.plan.skipped).toEqual(
      expect.arrayContaining([{ stripeDisputeId: matchedDispute, reason: "already_a_case" }]),
    );
    expect(await mine()).toHaveLength(2);
  });
});
