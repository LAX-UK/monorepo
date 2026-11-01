import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidIdentityDirectory,
  disputeAllocation,
  disputeCase,
  disputeCaseCandidate,
  legalEntity,
  lot,
  payment,
  payout,
  payoutLine,
} from "@auction/db/schema";
import {
  DrizzleAdminDisputeDeskReader,
  DrizzleDisputeCaseRepository,
  DrizzleDisputePaymentReader,
  DrizzlePayoutRepository,
} from "@auction/persistence/repositories";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { DisputeAllocationService } from "../disputes/dispute-allocation.service.js";
import { DisputeLineEffects } from "../disputes/dispute-line-effects.js";
import { PayoutAdjustmentService } from "../payout/payout-adjustment.service.js";
import { AdminDisputeDeskService } from "./admin-dispute-desk.service.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)(
  "the Disputes screen reads and allocates dispute cases (integration)",
  () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const runner = transactionRunnerFromDb(db);
    const payouts = new DrizzlePayoutRepository(db);
    const payoutAdjustments = new PayoutAdjustmentService(
      runner,
      payouts,
      (_root, tx) => new DrizzlePayoutRepository(tx),
    );
    const cases = new DrizzleDisputeCaseRepository(db);
    const events = mockDomainEventSink(vi.fn().mockResolvedValue(undefined));
    const desk = new AdminDisputeDeskService(
      new DrizzleAdminDisputeDeskReader(db),
      new DisputeAllocationService({
        transactionRunner: runner,
        cases,
        payments: new DrizzleDisputePaymentReader(),
        effects: new DisputeLineEffects({ cases, payoutAdjustments, events }),
        events,
      }),
    );

    const run = randomUUID().slice(0, 8);
    const buyerUserId = `dd-buyer-${run}`;
    const staffUserId = `dd-staff-${run}`;
    const buyerEntityId = randomUUID();
    const sellerA = randomUUID();
    const sellerB = randomUUID();
    const lotA = randomUUID();
    const lotB = randomUUID();
    const chargeId = `ch_dd_${run}`;
    const sharedCaseId = randomUUID();
    const unmatchedCaseId = randomUUID();
    const closedCaseId = randomUUID();
    let paymentA = "";
    let paymentB = "";

    const baseCase = {
      currency: "gbp",
      reason: "fraudulent",
      status: "needs_response",
      evidenceSubmitted: false,
      allocationState: "needs_allocation",
      stripeCreatedAt: new Date("2026-10-30T09:14:00Z"),
      lastEventAt: new Date("2026-10-30T09:14:00Z"),
    };

    beforeAll(async () => {
      const now = new Date();
      await seedIdentityUserFixtures(db, [
        { id: buyerUserId, name: "Hartley Collection", email: `${buyerUserId}@integration.test` },
        { id: staffUserId, name: "Hana Ito", email: `${staffUserId}@integration.test` },
      ]);
      const directoryRow = (subjectId: string, name: string) => ({
        subjectId,
        name,
        email: `${subjectId}@integration.test`,
        identityCreatedAt: now,
      });
      await db
        .insert(bidIdentityDirectory)
        .values([
          directoryRow(buyerUserId, "Hartley Collection"),
          directoryRow(staffUserId, "Hana Ito"),
        ]);
      const entity = (id: string, displayName: string) => ({
        id,
        displayName,
        kind: "individual" as const,
        subkind: "private_collector" as const,
        createdByUserId: buyerUserId,
        status: "approved" as const,
      });
      await db
        .insert(legalEntity)
        .values([
          entity(buyerEntityId, "Buyer"),
          entity(sellerA, `Northbank ${run}`),
          entity(sellerB, `Cedar ${run}`),
        ]);
      const lotRow = (id: string, title: string, seller: string) => ({
        id,
        title,
        images: [],
        auctionType: "english" as const,
        startingPrice: "10.00",
        currentPrice: "100.00",
        minBidIncrement: "10.00",
        startTime: new Date(now.getTime() - 3 * 86_400_000),
        endTime: new Date(now.getTime() - 86_400_000),
        status: "ended" as const,
        sellerLegalEntityId: seller,
        winnerId: buyerUserId,
        buyerLegalEntityId: buyerEntityId,
      });
      await db
        .insert(lot)
        .values([lotRow(lotA, `Thames ${run}`, sellerA), lotRow(lotB, `Chair ${run}`, sellerB)]);
      const paymentRow = (lotId: string, seller: string, amount: string, fee: string) => ({
        lotId,
        buyerId: buyerUserId,
        buyerLegalEntityId: buyerEntityId,
        sellerLegalEntityId: seller,
        amount,
        platformFee: fee,
        status: "captured" as const,
      });
      const inserted = await db
        .insert(payment)
        .values([
          paymentRow(lotA, sellerA, "800.00", "80.00"),
          paymentRow(lotB, sellerB, "200.00", "20.00"),
        ])
        .returning({ id: payment.id, lotId: payment.lotId });
      paymentA = inserted.find((p) => p.lotId === lotA)?.id as string;
      paymentB = inserted.find((p) => p.lotId === lotB)?.id as string;

      await db.insert(disputeCase).values([
        {
          ...baseCase,
          id: sharedCaseId,
          stripeDisputeId: `dp_dd_${run}_shared`,
          stripeChargeId: chargeId,
          amountPence: 100_000,
          dueBy: new Date(now.getTime() + 5 * 86_400_000),
          fundsWithdrawnAt: new Date("2026-10-31T02:10:00Z"),
        },
        {
          ...baseCase,
          id: unmatchedCaseId,
          stripeDisputeId: `dp_dd_${run}_unmatched`,
          stripeChargeId: `${chargeId}_none`,
          amountPence: 23_500,
          reason: "product_not_received",
          dueBy: new Date(now.getTime() + 11 * 86_400_000),
        },
        {
          ...baseCase,
          id: closedCaseId,
          stripeDisputeId: `dp_dd_${run}_closed`,
          stripeChargeId: `${chargeId}_closed`,
          amountPence: 5_000,
          status: "lost",
          allocationState: "allocated",
          closedAt: new Date("2026-11-20T08:00:00Z"),
          dueBy: null,
        },
      ]);
      await db.insert(disputeCaseCandidate).values([
        { caseId: sharedCaseId, paymentId: paymentA },
        { caseId: sharedCaseId, paymentId: paymentB },
      ]);
    });

    afterAll(async () => {
      const ids = [sharedCaseId, unmatchedCaseId, closedCaseId];
      await db.delete(disputeAllocation).where(inArray(disputeAllocation.caseId, ids));
      await db.delete(disputeCaseCandidate).where(inArray(disputeCaseCandidate.caseId, ids));
      await db.delete(disputeCase).where(inArray(disputeCase.id, ids));
      const paymentIds = [paymentA, paymentB].filter(Boolean);
      if (paymentIds.length) {
        await db.delete(payoutLine).where(inArray(payoutLine.paymentId, paymentIds));
        await db.delete(payment).where(inArray(payment.id, paymentIds));
      }
      await db.delete(payout).where(inArray(payout.legalEntityId, [sellerA, sellerB]));
      await db.delete(lot).where(inArray(lot.id, [lotA, lotB]));
      await db
        .delete(legalEntity)
        .where(inArray(legalEntity.id, [buyerEntityId, sellerA, sellerB]));
      await db
        .delete(bidIdentityDirectory)
        .where(inArray(bidIdentityDirectory.subjectId, [buyerUserId, staffUserId]));
      await deleteIdentityUserFixtures(db, [buyerUserId, staffUserId]);
    });

    const mine = <T extends { stripeDisputeId: string }>(rows: T[]): T[] =>
      rows.filter((r) => r.stripeDisputeId.startsWith(`dp_dd_${run}_`));

    it("lists the cases of a view, soonest respond-by first, closed cases last", async () => {
      const all = await desk.listCases({ view: "all", limit: 200, offset: 0 });
      expect(mine(all.rows).map((r) => r.stripeDisputeId)).toEqual([
        `dp_dd_${run}_shared`,
        `dp_dd_${run}_unmatched`,
        `dp_dd_${run}_closed`,
      ]);
    });

    it("sorts cases into the queues and counts each one", async () => {
      const needs = await desk.listCases({ view: "needs_allocation", limit: 200, offset: 0 });
      expect(mine(needs.rows)).toHaveLength(2);
      const closed = await desk.listCases({ view: "closed", limit: 200, offset: 0 });
      expect(mine(closed.rows).map((r) => r.stripeDisputeId)).toEqual([`dp_dd_${run}_closed`]);
      const open = await desk.listCases({ view: "open", limit: 200, offset: 0 });
      expect(mine(open.rows)).toHaveLength(2);
      expect(open.counts.all).toBeGreaterThanOrEqual(3);
      expect(open.counts.needs_allocation).toBeGreaterThanOrEqual(2);
    });

    it("describes a case on a shared charge by its invoices, buyer and sellers", async () => {
      const page = await desk.listCases({ view: "all", limit: 200, offset: 0 });
      const row = page.rows.find((r) => r.id === sharedCaseId);
      expect(row).toMatchObject({
        invoiceCount: 2,
        lotTitle: null,
        buyerLabel: "Hartley Collection",
        awaitingAllocation: true,
        amountPence: 100_000,
        reason: "fraudulent",
      });
      expect([...(row?.sellerNames ?? [])].sort()).toEqual([`Cedar ${run}`, `Northbank ${run}`]);
      const unmatched = page.rows.find((r) => r.id === unmatchedCaseId);
      expect(unmatched).toMatchObject({ invoiceCount: 0, buyerId: null, awaitingAllocation: true });
    });

    it("searches by dispute ID, lot, buyer and seller, and filters by reason", async () => {
      const find = async (q: string) =>
        mine((await desk.listCases({ view: "all", q, limit: 50, offset: 0 })).rows).map(
          (r) => r.id,
        );
      expect(await find(`dp_dd_${run}_unmatched`)).toEqual([unmatchedCaseId]);
      expect(await find(`Thames ${run}`)).toEqual([sharedCaseId]);
      expect(await find("Hartley Collection")).toEqual([sharedCaseId]);
      expect(await find(`Cedar ${run}`)).toEqual([sharedCaseId]);
      expect(await find("no such thing at all")).toEqual([]);
      const byReason = await desk.listCases({
        view: "all",
        reason: "product_not_received",
        limit: 200,
        offset: 0,
      });
      expect(mine(byReason.rows).map((r) => r.id)).toEqual([unmatchedCaseId]);
    });

    it("pages with a next-page flag", async () => {
      const first = await desk.listCases({ view: "all", limit: 1, offset: 0 });
      expect(first.rows).toHaveLength(1);
      expect(first.hasNextPage).toBe(true);
    });

    it("opens a case with its invoices, their fees and a timeline", async () => {
      const found = await desk.getCase(sharedCaseId);
      expect(found).toMatchObject({
        version: 1,
        chargeId,
        fundsWithdrawnAt: "2026-10-31T02:10:00.000Z",
        allocations: [],
      });
      const byLot = new Map(found?.invoices.map((i) => [i.lotTitle, i]));
      expect(byLot.get(`Thames ${run}`)).toMatchObject({
        invoicePence: 80_000,
        platformFeePence: 8_000,
        sellerName: `Northbank ${run}`,
      });
      expect(found?.timeline.map((e) => e.kind)).toEqual(["funds_withdrawn", "opened"]);
      expect(await desk.getCase(randomUUID())).toBeNull();
    });

    it("allocates a shared charge, moves each seller's net share and records who did it", async () => {
      const result = await desk.allocate({
        caseId: sharedCaseId,
        expectedVersion: 1,
        lines: [
          { paymentId: paymentA, amountPence: 80_000 },
          { paymentId: paymentB, amountPence: 20_000 },
        ],
        actorUserId: staffUserId,
        note: "The buyer paid for both lots in one checkout.",
      });
      expect(result.isOk()).toBe(true);

      const found = await desk.getCase(sharedCaseId);
      expect(found).toMatchObject({
        awaitingAllocation: false,
        allocationState: "allocated",
        version: 2,
      });
      const lineA = found?.allocations.find((l) => l.paymentId === paymentA);
      expect(lineA).toMatchObject({
        amountPence: 80_000,
        sellerSharePence: 72_000,
        source: "staff",
        allocatedByName: "Hana Ito",
        clawback: "withdrawn",
      });
      expect(found?.allocations.find((l) => l.paymentId === paymentB)?.sellerSharePence).toBe(
        18_000,
      );
      expect(found?.timeline[0]).toMatchObject({
        kind: "allocated_by_staff",
        actor: "Hana Ito",
        invoiceCount: 2,
      });
    });

    it("refuses a second allocation and a stale one", async () => {
      const again = await desk.allocate({
        caseId: sharedCaseId,
        expectedVersion: 2,
        lines: [{ paymentId: paymentA, amountPence: 100_000 }],
        actorUserId: staffUserId,
      });
      expect(again.isErr() && again.error).toBe("already_allocated");
      const stale = await desk.allocate({
        caseId: sharedCaseId,
        expectedVersion: 1,
        lines: [{ paymentId: paymentA, amountPence: 100_000 }],
        actorUserId: staffUserId,
      });
      expect(stale.isErr() && stale.error).toBe("version_conflict");
    });

    it("refuses shares that do not add up, and an invoice the charge did not pay", async () => {
      const mismatch = await desk.allocate({
        caseId: unmatchedCaseId,
        expectedVersion: 1,
        lines: [{ paymentId: paymentB, amountPence: 10_000 }],
        actorUserId: staffUserId,
      });
      expect(mismatch.isErr() && mismatch.error).toBe("total_mismatch");
      const [row] = await db
        .select({ state: disputeCase.allocationState })
        .from(disputeCase)
        .where(eq(disputeCase.id, unmatchedCaseId));
      expect(row?.state).toBe("needs_allocation");
    });
  },
);
