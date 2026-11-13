import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bidInvoice,
  bidInvoiceLine,
  consignmentAgreement,
  itemSubmission,
  legalEntity,
  lot,
  payment,
  paymentRefund,
  payout,
  payoutLine,
  saleSellerTerms,
} from "@auction/db/schema";
import {
  PayoutAdjustmentService,
  type PayoutSettlementDeps,
  createSettlement,
  payoutRepoForTx,
  settlementSellerTermsForTx,
} from "@auction/finance-runtime";
import {
  DrizzleAdminWorkItemsReader,
  DrizzlePayoutRepository,
  DrizzleSoldLotsReader,
  DrizzleTransactionRunner,
} from "@auction/persistence/repositories";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const pounds = (amount: number) => Math.round(amount * 100);

type SaleSeed = {
  hammer: number;
  premium: number;
  /** The agreement behind the lot: its commission, or `null` for none on record. */
  commissionPercent: string | null;
  /** The snapshot stored at raise; left out, the payment predates snapshots. */
  raised?: "agreement" | "held" | "none";
  laxOwned?: boolean;
};

/**
 * A payout run against a real database: each sale paid from its seller-terms snapshot, held sales
 * left out and released once the agreement is on record, payments raised before snapshots priced
 * at payout, LAX's own stock never paid, and a refund after payout charging the seller their net.
 */
describe.skipIf(!HAS_DB)("payout run on seller terms (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzlePayoutRepository(db);
  const runner = new DrizzleTransactionRunner(db);
  const events: { eventType: string; payload: Record<string, unknown> }[] = [];
  const deps: PayoutSettlementDeps = {
    repo,
    transactionRunner: runner,
    domainEventSink: {
      withTx: () => ({
        publish: async (event) => {
          events.push(event as never);
        },
      }),
    },
    payoutAdjustments: undefined,
    payoutRepoForTx: (tx) => payoutRepoForTx(repo, tx),
    sellerTermsForTx: settlementSellerTermsForTx,
  };

  const buyerId = `payout-terms-buyer-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const laxEntity = randomUUID();
  const lotIds: string[] = [];
  const submissionIds: string[] = [];

  async function seedSale(seed: SaleSeed) {
    const seller = seed.laxOwned ? laxEntity : sellerEntity;
    const lotId = randomUUID();
    lotIds.push(lotId);
    await db.insert(lot).values({
      id: lotId,
      title: `Settle ${lotId.slice(0, 6)}`,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: seed.hammer.toFixed(2),
      minBidIncrement: "10.00",
      startTime: new Date(Date.now() - 10 * 86_400_000),
      endTime: new Date(Date.now() - 2 * 86_400_000),
      status: "ended",
      sellerLegalEntityId: seller,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntity,
    });
    let agreementId: string | null = null;
    if (seed.commissionPercent !== null) {
      const submissionId = randomUUID();
      submissionIds.push(submissionId);
      await db.insert(itemSubmission).values({
        id: submissionId,
        legalEntityId: seller,
        title: "Consigned work",
        convertedLotId: lotId,
      });
      const [agreement] = await db
        .insert(consignmentAgreement)
        .values({
          submissionId,
          legalEntityId: seller,
          termsVersion: "v1",
          commissionPercent: seed.commissionPercent,
          acceptedAt: new Date("2026-10-01T10:00:00Z"),
        })
        .returning({ id: consignmentAgreement.id });
      agreementId = agreement?.id ?? null;
    }
    const totalPence = pounds(seed.hammer) + pounds(seed.premium);
    const [invoice] = await db
      .insert(bidInvoice)
      .values({
        lotId,
        buyerLegalEntityId: buyerEntity,
        sellerLegalEntityId: seller,
        totalPence,
        raisedAt: new Date(),
        dueAt: new Date(Date.now() + 86_400_000),
      })
      .returning({ id: bidInvoice.id });
    if (!invoice) throw new Error("invoice was not stored");
    await db.insert(bidInvoiceLine).values([
      {
        invoiceId: invoice.id,
        position: 1,
        kind: "hammer",
        label: "Hammer",
        amountPence: pounds(seed.hammer),
      },
      {
        invoiceId: invoice.id,
        position: 2,
        kind: "buyers_premium",
        label: "Buyer's premium",
        amountPence: pounds(seed.premium),
      },
    ]);
    const [paid] = await db
      .insert(payment)
      .values({
        lotId,
        buyerId,
        buyerLegalEntityId: buyerEntity,
        sellerLegalEntityId: seller,
        amount: (totalPence / 100).toFixed(2),
        // The old rule's 5% of hammer plus premium: kept for audit, never paid from.
        platformFee: (Math.round(totalPence * 0.05) / 100).toFixed(2),
        status: "captured",
        invoiceId: invoice.id,
      })
      .returning({ id: payment.id });
    if (!paid) throw new Error("payment was not stored");
    const base = {
      paymentId: paid.id,
      lotId,
      sellerLegalEntityId: seller,
      hammerPence: pounds(seed.hammer),
      premiumPence: pounds(seed.premium),
      ruleVersion: "agreement_hammer_v1",
    };
    if (seed.raised === "held") {
      await db
        .insert(saleSellerTerms)
        .values({ ...base, basis: "held", heldReason: "no_agreement" });
    } else if (seed.raised === "agreement" && agreementId) {
      await db.insert(saleSellerTerms).values({
        ...base,
        basis: "agreement",
        agreementId,
        commissionBps: 1500,
        commissionPence: pounds(seed.hammer * 0.15),
        commissionVatTreatment: "standard",
        commissionVatBps: 2000,
        commissionVatPence: pounds(seed.hammer * 0.03),
        sellerNetPence:
          pounds(seed.hammer) - pounds(seed.hammer * 0.15) - pounds(seed.hammer * 0.03),
      });
    } else if (seed.laxOwned) {
      await db.insert(saleSellerTerms).values({ ...base, basis: "lax_owned" });
    }
    return { lotId, paymentId: paid.id };
  }

  async function recordAgreement(lotId: string, commissionPercent: string) {
    const submissionId = randomUUID();
    submissionIds.push(submissionId);
    await db.insert(itemSubmission).values({
      id: submissionId,
      legalEntityId: sellerEntity,
      title: "Recorded work",
      convertedLotId: lotId,
    });
    await db.insert(consignmentAgreement).values({
      submissionId,
      legalEntityId: sellerEntity,
      termsVersion: "v1",
      commissionPercent,
      acceptedAt: new Date("2026-11-01T10:00:00Z"),
    });
  }

  const linesOf = (payoutId: string) =>
    db.select().from(payoutLine).where(eq(payoutLine.payoutId, payoutId));

  beforeAll(async () => {
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: buyerId, email: `${buyerId}@integration.test` },
    ]);
    for (const [id, kind, subkind] of [
      [buyerEntity, "individual", "private_collector"],
      [sellerEntity, "organisation", "gallery"],
      [laxEntity, "organisation", "lax_stock"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: `Entity ${id.slice(0, 4)}`,
        kind,
        subkind,
        createdByUserId: buyerId,
        status: "approved",
      });
    }
  });

  afterAll(async () => {
    const payouts = await db
      .select({ id: payout.id })
      .from(payout)
      .where(inArray(payout.legalEntityId, [sellerEntity, laxEntity]));
    if (payouts.length) {
      const ids = payouts.map((p) => p.id);
      await db.delete(payoutLine).where(inArray(payoutLine.payoutId, ids));
      await db.delete(payout).where(inArray(payout.id, ids));
    }
    await db.delete(saleSellerTerms).where(inArray(saleSellerTerms.lotId, lotIds));
    const paymentIds = (
      await db.select({ id: payment.id }).from(payment).where(inArray(payment.lotId, lotIds))
    ).map((p) => p.id);
    if (paymentIds.length) {
      await db.delete(paymentRefund).where(inArray(paymentRefund.paymentId, paymentIds));
    }
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, lotIds));
    if (submissionIds.length) {
      await db
        .delete(consignmentAgreement)
        .where(inArray(consignmentAgreement.submissionId, submissionIds));
      await db.delete(itemSubmission).where(inArray(itemSubmission.id, submissionIds));
    }
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db
      .delete(legalEntity)
      .where(inArray(legalEntity.id, [buyerEntity, sellerEntity, laxEntity]));
    await deleteIdentityUserFixtures(db, [buyerId]);
  });

  it("pays ready sales from their snapshots, holds the one without an agreement, prices an old payment, and pays LAX nothing", async () => {
    const owner = await seedSale({
      hammer: 82_000,
      premium: 20_500,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    const old = await seedSale({
      hammer: 10_000,
      premium: 2_500,
      commissionPercent: "3.00",
      raised: "none",
    });
    const held = await seedSale({
      hammer: 6_200,
      premium: 1_550,
      commissionPercent: null,
      raised: "held",
    });
    const laxOwned = await seedSale({
      hammer: 4_800,
      premium: 1_200,
      commissionPercent: null,
      laxOwned: true,
    });

    const result = await createSettlement(deps, "staff-1", {
      legalEntityId: sellerEntity,
      periodEnd: new Date(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.heldSales).toEqual([
      { paymentId: held.paymentId, lotId: held.lotId, reason: "no_agreement" },
    ]);
    // £82,000 at 15% + VAT pays £67,240.00; £10,000 at 3% + VAT pays £9,640.00.
    expect(result.payout).toMatchObject({
      grossAmount: "92000.00",
      platformFee: "15120.00",
      netAmount: "76880.00",
      sellerTermsTotals: { hammer: "92000.00", commission: "12600.00", commissionVat: "2520.00" },
    });
    const lines = await linesOf(result.payout.id);
    expect(lines.map((l) => l.paymentId).sort()).toEqual([owner.paymentId, old.paymentId].sort());
    expect(lines.every((l) => l.sellerTermsId !== null)).toBe(true);

    // The old payment was priced at payout, with the old fee kept beside the new figures.
    const [priced] = await db
      .select()
      .from(saleSellerTerms)
      .where(eq(saleSellerTerms.paymentId, old.paymentId));
    expect(priced).toMatchObject({
      basis: "agreement",
      source: "recomputed_at_payout",
      sellerNetPence: pounds(9_640),
      legacyPlatformFeePence: pounds(625),
    });

    // LAX's own stock is not waiting for a payout at all.
    expect(await repo.listLegalEntityIdsWithUnlinkedCapturedPayments()).not.toContain(laxEntity);
    expect(await repo.findUnlinkedCapturedPayments(laxEntity)).toEqual([]);
    expect(laxOwned.paymentId).toBeTruthy();

    // The event carries each sale's split, so the accounts never work it out again.
    const event = events.find((e) => e.eventType === "payout.settlement_created");
    expect(event?.payload).toMatchObject({
      hammerAmount: "92000.00",
      commissionAmount: "12600.00",
    });
    expect((event?.payload.sales as unknown[]).length).toBe(2);

    // Running again pays nothing twice: only the held sale is still waiting.
    const again = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: new Date(),
    });
    expect(again).toMatchObject({ ok: false, reason: "no_pending_payments" });

    // The held sale is an Inbox task for the sales team, naming its fix; its figure is not shown.
    const workItems = new DrizzleAdminWorkItemsReader(db);
    const heldItem = (await workItems.listHeldSellerPayouts(200)).find(
      (item) => item.href === `/admin/lots/${held.lotId}`,
    );
    expect(heldItem).toMatchObject({
      kind: "seller_payout_held",
      subtitle: "No signed agreement on record. Record the signed agreement to release it",
    });
    const soldBefore = await new DrizzleSoldLotsReader(db).list({
      legalEntityId: sellerEntity,
      limit: 50,
      offset: 0,
    });
    expect(soldBefore.find((s) => s.lotId === held.lotId)?.payment?.sellerSide).toBeNull();

    // Recording the agreement releases the held sale into the next run.
    await recordAgreement(held.lotId, "15.00");
    const released = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: new Date(Date.now() + 1000),
    });
    expect(released.ok).toBe(true);
    if (!released.ok) return;
    // £6,200 at 15% + VAT: £930.00 and £186.00 taken, £5,084.00 paid.
    expect(released.payout).toMatchObject({ grossAmount: "6200.00", netAmount: "5084.00" });
    const [repriced] = await db
      .select()
      .from(saleSellerTerms)
      .where(eq(saleSellerTerms.paymentId, held.paymentId));
    expect(repriced).toMatchObject({ basis: "agreement", source: "recomputed_at_payout" });
    // Its Inbox task clears itself once the sale is paid.
    expect(
      (await workItems.listHeldSellerPayouts(200)).some((i) => i.sourceId === heldItem?.sourceId),
    ).toBe(false);

    // The seller's sold list reads the same figures.
    const sold = await new DrizzleSoldLotsReader(db).list({
      legalEntityId: sellerEntity,
      limit: 50,
      offset: 0,
    });
    expect(sold.find((s) => s.lotId === owner.lotId)?.payment?.sellerSide).toEqual({
      amount: "82000.00",
      platformFee: "14760.00",
    });
  });

  it("a full refund after payout charges the seller the net they received, not the buyer's total", async () => {
    const sale = await seedSale({
      hammer: 1_000,
      premium: 250,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    const settled = await createSettlement(deps, null, {
      legalEntityId: sellerEntity,
      periodEnd: new Date(Date.now() + 2000),
    });
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    await db.update(payout).set({ status: "paid" }).where(eq(payout.id, settled.payout.id));

    await runner.runInTransaction(async (tx) => {
      await new PayoutAdjustmentService(runner, repo).addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: sellerEntity,
        paymentId: sale.paymentId,
        amount: "-1250.00",
        kind: "refund",
        sourceEventId: `evt-${sale.paymentId}`,
        note: "Refund",
        tx,
      });
    });
    const [refund] = await db
      .select()
      .from(payoutLine)
      .where(and(eq(payoutLine.paymentId, sale.paymentId), eq(payoutLine.kind, "refund")));
    // £1,000 at 15% + VAT paid the seller £820.00; that is what comes back.
    expect(refund).toMatchObject({ amount: "-820.00", buyerRefundPence: pounds(1_250) });
    expect(await repo.sumRefundLineCentsForPayment(sale.paymentId)).toBe(pounds(1_250));
  });

  it("a refund before payout charges the seller nothing, and the seller's side counts it as dealt with", async () => {
    const sale = await seedSale({
      hammer: 2_000,
      premium: 500,
      commissionPercent: "15.00",
      raised: "agreement",
    });
    await runner.runInTransaction(async (tx) => {
      // The buyer's refund is recorded first, as every refund path does.
      await tx.insert(paymentRefund).values({
        paymentId: sale.paymentId,
        idempotencyKey: `staff-${sale.paymentId}`,
        amountPence: pounds(2_500),
        currency: "GBP",
        source: "staff",
      });
      await new PayoutAdjustmentService(runner, repo).addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: sellerEntity,
        paymentId: sale.paymentId,
        amount: "-2500.00",
        kind: "refund",
        sourceEventId: `staff-${sale.paymentId}`,
        note: "Refund",
        tx,
      });
    });
    const lines = await db
      .select()
      .from(payoutLine)
      .where(eq(payoutLine.paymentId, sale.paymentId));
    expect(lines).toEqual([]);
    // A card refund event for the same refund then finds nothing new for the seller, so the refund
    // is not announced twice.
    expect(await repo.sumRefundLineCentsForPayment(sale.paymentId)).toBe(pounds(2_500));
  });
});
