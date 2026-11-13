import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, lot, payment, payout, payoutLine, user } from "@auction/db/schema";
import {
  ConnectTransferInitiationService,
  type PayoutSettlementDeps,
  payoutRepoForTx,
  runBulkSettlementWithTransfers,
  settlementSellerTermsForTx,
} from "@auction/finance-runtime";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import {
  DrizzlePayoutRepository,
  DrizzleTransactionRunner,
} from "@auction/persistence/repositories";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PayoutAdjustmentService } from "./payout-adjustment.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * A dispute or refund line that finds no open payout makes a payout of its own with a negative
 * net (the reviewer's probe P8). The payout run moves it to `clawback_pending`, where staff see it,
 * unless later lines have netted it by then.
 */
describe.skipIf(!HAS_DB)("negative scheduled payouts on the payout run (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzlePayoutRepository(db);
  const runner = new DrizzleTransactionRunner(db);
  const run = randomUUID().slice(0, 8);
  const userId = `negative-payout-${run}`;
  const buyerId = randomUUID();
  const sellerId = randomUUID();
  const lotId = randomUUID();
  let paymentId: string;
  const events: { eventType: string; aggregateId: string }[] = [];

  const adjustments = new PayoutAdjustmentService(
    runner,
    repo,
    (_root, tx) => new DrizzlePayoutRepository(tx),
  );

  /** The real repository, its run-wide lists narrowed to this test's seller. */
  const scoped: IPayoutRepository = Object.assign(Object.create(repo) as IPayoutRepository, {
    listLegalEntityIdsWithUnlinkedCapturedPayments: async () => [],
    listScheduledPayoutsAwaitingTransfer: async (limit?: number) =>
      (await repo.listScheduledPayoutsAwaitingTransfer(limit)).filter(
        (p) => p.legalEntityId === sellerId,
      ),
    listScheduledPayoutsWithNegativeNet: async (limit?: number) =>
      (await repo.listScheduledPayoutsWithNegativeNet(limit)).filter(
        (p) => p.legalEntityId === sellerId,
      ),
  });
  const deps: PayoutSettlementDeps = {
    repo: scoped,
    transactionRunner: runner,
    domainEventSink: null,
    payoutAdjustments: undefined,
    payoutRepoForTx: (tx) => payoutRepoForTx(repo, tx),
    sellerTermsForTx: settlementSellerTermsForTx,
  };
  // The negative path moves the payout before any Stripe call: Stripe is never asked.
  const transfers = new ConnectTransferInitiationService(
    { warn: () => {}, error: () => {}, info: () => {} } as never,
    {
      findLegalEntityById: async () => ({ stripeConnectAccountId: "acct_negative" }),
      findStripeChargeIdByPaymentId: async () => null,
    } as never,
    { get: () => ({}) } as never,
    { syncAccountFromStripe: async () => ({ ready: true }) } as never,
    repo,
    {
      publish: async (event: { eventType: string; aggregateId: string }) => {
        events.push(event);
      },
    } as never,
    undefined,
    { runner },
  );
  const payoutRun = () =>
    runBulkSettlementWithTransfers(deps, null, {
      initiateTransfer: (payoutId, opts) => transfers.initiateTransfer(payoutId, opts),
    });

  const disputeLine = (amount: string, tag: string) =>
    adjustments.addPaymentLineToOpenPayoutOrCreateClawback({
      legalEntityId: sellerId,
      paymentId,
      amount,
      kind: "dispute",
      sourceEventId: `dispute:dp_neg_${run}_${tag}:${paymentId}`,
      note: `Dispute ${tag}`,
    });
  const sellerPayouts = () => db.select().from(payout).where(eq(payout.legalEntityId, sellerId));

  beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values({
      id: userId,
      name: "Negative Payout",
      email: `${userId}@integration.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(legalEntity).values(
      [buyerId, sellerId].map((id, i) => ({
        id,
        displayName: `Negative Payout ${i}`,
        kind: "individual" as const,
        subkind: "private_collector" as const,
        createdByUserId: userId,
        status: "approved" as const,
      })),
    );
    await db.insert(lot).values({
      id: lotId,
      title: "Negative payout",
      images: [],
      auctionType: "english",
      startingPrice: "10.00",
      currentPrice: "100.00",
      minBidIncrement: "10.00",
      startTime: new Date(now.getTime() - 3 * 86_400_000),
      endTime: new Date(now.getTime() - 86_400_000),
      status: "ended",
      sellerLegalEntityId: sellerId,
      winnerId: userId,
      buyerLegalEntityId: buyerId,
    });
    const [row] = await db
      .insert(payment)
      .values({
        lotId,
        buyerId: userId,
        buyerLegalEntityId: buyerId,
        sellerLegalEntityId: sellerId,
        amount: "100.00",
        platformFee: "5.00",
        status: "pending",
      })
      .returning({ id: payment.id });
    paymentId = row?.id as string;
  });

  const clearPayouts = async () => {
    const ids = (await sellerPayouts()).map((p) => p.id);
    if (ids.length) await db.delete(payoutLine).where(inArray(payoutLine.payoutId, ids));
    await db.delete(payout).where(eq(payout.legalEntityId, sellerId));
  };

  beforeEach(async () => {
    events.length = 0;
    await clearPayouts();
  });

  afterAll(async () => {
    await clearPayouts();
    await db.delete(payment).where(eq(payment.lotId, lotId));
    await db.delete(lot).where(eq(lot.id, lotId));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerId, sellerId]));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("moves a payout made negative by a line with no open payout to clawback (P8)", async () => {
    await disputeLine("-40.00", "1");
    const [made] = await sellerPayouts();
    expect(made).toMatchObject({ status: "scheduled", netAmount: "-40.00" });
    // Not one the run sends: before this, nothing ever picked it up.
    expect((await repo.listScheduledPayoutsAwaitingTransfer()).some((p) => p.id === made?.id)).toBe(
      false,
    );

    const result = await payoutRun();

    const [after] = await sellerPayouts();
    expect(after).toMatchObject({
      id: made?.id,
      status: "clawback_pending",
      failureReason: "negative_net_amount",
      stripeTransferId: null,
    });
    expect(after?.processedAt).not.toBeNull();
    expect(result.transfers.items).toEqual([
      expect.objectContaining({
        payoutId: made?.id,
        outcome: "committed_no_transfer",
        reason: "negative_net_amount",
      }),
    ]);
    expect(events).toEqual([
      expect.objectContaining({ eventType: "payout.clawback_required", aggregateId: made?.id }),
    ]);

    // It takes no more lines: the next one goes on a payout of its own.
    await disputeLine("-5.00", "2");
    const payouts = await sellerPayouts();
    expect(payouts).toHaveLength(2);
    expect(payouts.find((p) => p.id === made?.id)?.netAmount).toBe("-40.00");
  });

  it("leaves a negative payout that later lines netted before the run", async () => {
    await disputeLine("-40.00", "1");
    // The dispute is won: its reversal lands on the same, still open payout.
    await disputeLine("40.00", "1-reversed");

    await payoutRun();

    const [after] = await sellerPayouts();
    expect(after).toMatchObject({ status: "scheduled", netAmount: "0.00" });
    expect(events).toEqual([]);
  });

  it("runs again without touching a payout already in clawback", async () => {
    await disputeLine("-40.00", "1");
    await payoutRun();
    const second = await payoutRun();

    expect(second.transfers.items).toEqual([]);
    const [after] = await sellerPayouts();
    expect(after?.status).toBe("clawback_pending");
  });
});
