import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, lot, payment, payout, payoutLine } from "@auction/db/schema";
import type { DisputeAllocationRecord, DisputeCaseRecord } from "@auction/persistence/interfaces";
import {
  DrizzleDisputeCaseRepository,
  DrizzlePayoutRepository,
} from "@auction/persistence/repositories";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { DisputeLineEffects } from "../disputes/dispute-line-effects.js";
import type { AddPaymentPayoutLineInput } from "../interfaces/payout-adjustment.js";
import { PayoutAdjustmentService } from "./payout-adjustment.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Two disputes over group charges whose invoices span the same two sellers, each moving the
 * sellers' payouts in the opposite order (the reviewer's probe P3). Each holds its own payments,
 * so only the payout rows are shared: they are held in one order (legal entity id, then payout id)
 * before either moves any, so one case waits for the other instead of deadlocking.
 */
describe.skipIf(!HAS_DB)("payouts of several sellers in one transaction (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const url = process.env.DATABASE_URL!;
  const db = createDb(url);
  const payouts = new DrizzlePayoutRepository(db);
  const run = randomUUID().slice(0, 8);
  const userId = `cross-seller-${run}`;
  const buyerId = randomUUID();
  const [sellerA, sellerB] = [randomUUID(), randomUUID()].sort() as [string, string];
  const lotIds = Array.from({ length: 4 }, () => randomUUID());
  /** Two invoices for each seller: one in each case. */
  const paymentFor: Record<string, string> = {};
  const payoutOf: Record<string, string> = {};

  beforeAll(async () => {
    const now = new Date();
    await seedIdentityUserFixtures(db, [
      { id: userId, name: "Cross Seller", email: `${userId}@integration.test` },
    ]);
    await db.insert(legalEntity).values(
      [buyerId, sellerA, sellerB].map((id, i) => ({
        id,
        displayName: `Cross Seller ${i}`,
        kind: "individual" as const,
        subkind: "private_collector" as const,
        createdByUserId: userId,
        status: "approved" as const,
      })),
    );
    const sellerOfLot = [sellerA, sellerB, sellerA, sellerB];
    await db.insert(lot).values(
      lotIds.map((id, i) => ({
        id,
        title: `Cross seller ${i}`,
        images: [],
        auctionType: "english" as const,
        startingPrice: "10.00",
        currentPrice: "100.00",
        minBidIncrement: "10.00",
        startTime: new Date(now.getTime() - 3 * 86_400_000),
        endTime: new Date(now.getTime() - 86_400_000),
        status: "ended" as const,
        sellerLegalEntityId: sellerOfLot[i] as string,
        winnerId: userId,
        buyerLegalEntityId: buyerId,
      })),
    );
    const rows = await db
      .insert(payment)
      .values(
        lotIds.map((lotId, i) => ({
          lotId,
          buyerId: userId,
          buyerLegalEntityId: buyerId,
          sellerLegalEntityId: sellerOfLot[i] as string,
          amount: "100.00",
          platformFee: "5.00",
          status: "captured" as const,
        })),
      )
      .returning({ id: payment.id, lotId: payment.lotId });
    for (const [i, key] of ["A1", "B1", "A2", "B2"].entries()) {
      paymentFor[key] = rows.find((r) => r.lotId === lotIds[i])?.id as string;
    }
    for (const seller of [sellerA, sellerB]) {
      const created = await payouts.create({
        legalEntityId: seller,
        periodStart: new Date(now.getTime() - 86_400_000),
        periodEnd: now,
        grossAmount: "100.00",
        platformFee: "0.00",
        stripeFee: "0.00",
        netAmount: "100.00",
        currency: "GBP",
      });
      await payouts.insertLine({
        payoutId: created.id,
        paymentId: null,
        amount: "100.00",
        kind: "adjustment",
        createdByUserId: userId,
        note: "Opening balance",
      });
      payoutOf[seller] = created.id;
    }
  });

  afterAll(async () => {
    const ids = Object.values(payoutOf);
    await db.delete(payoutLine).where(inArray(payoutLine.payoutId, ids));
    await db.delete(payout).where(inArray(payout.legalEntityId, [sellerA, sellerB]));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerId, sellerA, sellerB]));
    await deleteIdentityUserFixtures(db, [userId]);
  });

  const caseRecord = (n: number) =>
    ({
      id: randomUUID(),
      stripeDisputeId: `dp_cross_${run}_${n}`,
      fundsWithdrawnAt: new Date(),
      fundsReinstatedAt: null,
    }) as DisputeCaseRecord;

  const line = (caseId: string, key: string, seller: string): DisputeAllocationRecord => ({
    id: randomUUID(),
    caseId,
    paymentId: paymentFor[key] as string,
    sellerLegalEntityId: seller,
    amountPence: 10_000,
    sellerSharePence: 1_000,
    clawback: "none",
    source: "staff",
  });

  it("lets two cases that move the same two sellers in opposite order both finish", async () => {
    const real = new PayoutAdjustmentService(
      transactionRunnerFromDb(db),
      payouts,
      (_root, tx) => new DrizzlePayoutRepository(tx),
    );
    // Each case pauses after its first line until the other has moved one too (or a second has
    // passed): without one payout order, each would then hold one seller's payout.
    const firstLine: Record<string, () => void> = {};
    const firstLineDone: Record<string, Promise<void>> = {};
    for (const n of [1, 2]) {
      firstLineDone[`dp_cross_${run}_${n}`] = new Promise((resolve) => {
        firstLine[`dp_cross_${run}_${n}`] = resolve;
      });
    }
    const caseOfLine = (input: AddPaymentPayoutLineInput) =>
      (input.sourceEventId ?? "").split(":")[1] as string;
    const pace = async (input: AddPaymentPayoutLineInput) => {
      const own = caseOfLine(input);
      const other = own.endsWith("_1") ? `dp_cross_${run}_2` : `dp_cross_${run}_1`;
      const isFirst = firstLine[own];
      if (!isFirst) return;
      delete firstLine[own];
      isFirst();
      await Promise.race([
        firstLineDone[other],
        new Promise((resolve) => setTimeout(resolve, 1_000)),
      ]);
    };
    const effects = (conn: typeof db) =>
      new DisputeLineEffects({
        cases: new DrizzleDisputeCaseRepository(conn),
        payoutAdjustments: {
          lockOpenPayoutsForSellers: (input) => real.lockOpenPayoutsForSellers(input),
          addPaymentLineToOpenPayoutOrCreateClawback: async (input) => {
            await real.addPaymentLineToOpenPayoutOrCreateClawback(input);
            await pace(input);
          },
        },
        events: mockDomainEventSink(),
      });

    const first = caseRecord(1);
    const second = caseRecord(2);
    const one = createDb(url);
    const two = createDb(url);
    const caseOne = one.transaction((tx) =>
      effects(one).reconcile(
        tx,
        first,
        [line(first.id, "A1", sellerA), line(first.id, "B1", sellerB)],
        "Reversed",
      ),
    );
    await firstLineDone[first.stripeDisputeId];
    const caseTwo = two.transaction((tx) =>
      effects(two).reconcile(
        tx,
        second,
        [line(second.id, "B2", sellerB), line(second.id, "A2", sellerA)],
        "Reversed",
      ),
    );
    const outcomes = await Promise.allSettled([caseOne, caseTwo]);

    expect(
      outcomes.map((o) =>
        o.status === "fulfilled"
          ? "ok"
          : ((o.reason as { cause?: { code?: string } }).cause?.code ?? String(o.reason)),
      ),
    ).toEqual(["ok", "ok"]);
    // Each seller's open payout took both cases' lines, and its net is its lines added up.
    for (const seller of [sellerA, sellerB]) {
      const held = await payouts.findById(payoutOf[seller] as string);
      const lines = await payouts.listLines(payoutOf[seller] as string);
      expect(lines.map((l) => l.amount).sort()).toEqual(["-10.00", "-10.00", "100.00"]);
      expect(held?.netAmount).toBe("80.00");
    }
  });
});
