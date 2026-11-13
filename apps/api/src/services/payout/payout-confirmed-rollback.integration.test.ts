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
  payout,
  payoutLine,
  saleSellerTerms,
} from "@auction/db/schema";
import {
  type PayoutSettlementDeps,
  createSettlement,
  payoutRepoForTx,
  settlementSellerTermsForTx,
} from "@auction/finance-runtime";
import {
  DrizzlePayoutRepository,
  DrizzleTransactionRunner,
} from "@auction/persistence/repositories";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const pounds = (amount: number) => Math.round(amount * 100);

/**
 * A confirmed run refused with `figures_changed` rolls back everything it wrote before the check:
 * the snapshot it stores for a payment raised before snapshots, and the re-pricing of a held sale
 * whose agreement is now on record. Nothing is stored until a run pays.
 */
describe.skipIf(!HAS_DB)("a refused confirmed payout run stores nothing (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzlePayoutRepository(db);
  const events: string[] = [];
  const deps: PayoutSettlementDeps = {
    repo,
    transactionRunner: new DrizzleTransactionRunner(db),
    domainEventSink: {
      withTx: () => ({
        publish: async (event) => {
          events.push(event.eventType);
        },
      }),
    },
    payoutAdjustments: undefined,
    payoutRepoForTx: (tx) => payoutRepoForTx(repo, tx),
    sellerTermsForTx: settlementSellerTermsForTx,
  };

  const buyerId = `payout-rollback-buyer-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const sellerEntity = randomUUID();
  const lotIds: string[] = [];
  const submissionIds: string[] = [];

  async function agreementFor(lotId: string, commissionPercent: string) {
    const submissionId = randomUUID();
    submissionIds.push(submissionId);
    await db.insert(itemSubmission).values({
      id: submissionId,
      legalEntityId: sellerEntity,
      title: "Consigned work",
      convertedLotId: lotId,
    });
    await db.insert(consignmentAgreement).values({
      submissionId,
      legalEntityId: sellerEntity,
      termsVersion: "v1",
      commissionPercent,
      acceptedAt: new Date("2026-10-01T10:00:00Z"),
    });
  }

  /** A captured sale: `none` predates snapshots (agreement on record), `held` has no agreement. */
  async function seedSale(hammer: number, raised: "none" | "held") {
    const lotId = randomUUID();
    lotIds.push(lotId);
    await db.insert(lot).values({
      id: lotId,
      title: `Rollback ${lotId.slice(0, 6)}`,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice: hammer.toFixed(2),
      minBidIncrement: "10.00",
      startTime: new Date(Date.now() - 10 * 86_400_000),
      endTime: new Date(Date.now() - 2 * 86_400_000),
      status: "ended",
      sellerLegalEntityId: sellerEntity,
      winnerId: buyerId,
      buyerLegalEntityId: buyerEntity,
    });
    if (raised === "none") await agreementFor(lotId, "15.00");
    const premium = hammer * 0.25;
    const totalPence = pounds(hammer) + pounds(premium);
    const [invoice] = await db
      .insert(bidInvoice)
      .values({
        lotId,
        buyerLegalEntityId: buyerEntity,
        sellerLegalEntityId: sellerEntity,
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
        amountPence: pounds(hammer),
      },
      {
        invoiceId: invoice.id,
        position: 2,
        kind: "buyers_premium",
        label: "Buyer's premium",
        amountPence: pounds(premium),
      },
    ]);
    const [paid] = await db
      .insert(payment)
      .values({
        lotId,
        buyerId,
        buyerLegalEntityId: buyerEntity,
        sellerLegalEntityId: sellerEntity,
        amount: (totalPence / 100).toFixed(2),
        platformFee: (Math.round(totalPence * 0.05) / 100).toFixed(2),
        status: "captured",
        invoiceId: invoice.id,
      })
      .returning({ id: payment.id });
    if (!paid) throw new Error("payment was not stored");
    if (raised === "held") {
      await db.insert(saleSellerTerms).values({
        paymentId: paid.id,
        lotId,
        sellerLegalEntityId: sellerEntity,
        hammerPence: pounds(hammer),
        premiumPence: pounds(premium),
        ruleVersion: "agreement_hammer_v1",
        basis: "held",
        heldReason: "no_agreement",
      });
    }
    return { lotId, paymentId: paid.id };
  }

  const termsOf = (paymentId: string) =>
    db.select().from(saleSellerTerms).where(eq(saleSellerTerms.paymentId, paymentId));

  beforeAll(async () => {
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: buyerId, email: `${buyerId}@integration.test` },
    ]);
    for (const [id, kind, subkind] of [
      [buyerEntity, "individual", "private_collector"],
      [sellerEntity, "organisation", "gallery"],
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
      .where(eq(payout.legalEntityId, sellerEntity));
    if (payouts.length) {
      const ids = payouts.map((p) => p.id);
      await db.delete(payoutLine).where(inArray(payoutLine.payoutId, ids));
      await db.delete(payout).where(inArray(payout.id, ids));
    }
    await db.delete(saleSellerTerms).where(inArray(saleSellerTerms.lotId, lotIds));
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, lotIds));
    if (submissionIds.length) {
      await db
        .delete(consignmentAgreement)
        .where(inArray(consignmentAgreement.submissionId, submissionIds));
      await db.delete(itemSubmission).where(inArray(itemSubmission.id, submissionIds));
    }
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db.delete(legalEntity).where(inArray(legalEntity.id, [buyerEntity, sellerEntity]));
    await deleteIdentityUserFixtures(db, [buyerId]);
  });

  it("rolls back the snapshot and the re-pricing it wrote, then a run with the right figures pays", async () => {
    const old = await seedSale(10_000, "none");
    const held = await seedSale(6_200, "held");
    await agreementFor(held.lotId, "15.00");

    // Confirmed from a preview taken before the held sale's agreement was recorded.
    const refused = await createSettlement(deps, "staff-1", {
      legalEntityId: sellerEntity,
      periodEnd: new Date(),
      confirmed: { netPence: pounds(8_200), paymentIds: [old.paymentId], dealIds: [] },
    });
    expect(refused).toMatchObject({ ok: false, reason: "figures_changed" });

    // Nothing the refused run wrote is kept: no snapshot, no re-pricing, no payout, no event.
    expect(await termsOf(old.paymentId)).toEqual([]);
    const [stillHeld] = await termsOf(held.paymentId);
    expect(stillHeld).toMatchObject({ basis: "held", heldReason: "no_agreement" });
    expect(await db.select().from(payout).where(eq(payout.legalEntityId, sellerEntity))).toEqual(
      [],
    );
    expect(events).toEqual([]);

    // The same figures confirmed again, now right: £10,000 and £6,200 at 15% + VAT.
    const paid = await createSettlement(deps, "staff-1", {
      legalEntityId: sellerEntity,
      periodEnd: new Date(),
      confirmed: {
        netPence: pounds(8_200) + pounds(5_084),
        paymentIds: [old.paymentId, held.paymentId],
        dealIds: [],
      },
    });
    expect(paid.ok).toBe(true);
    expect(await termsOf(old.paymentId)).toEqual([
      expect.objectContaining({ basis: "agreement", source: "recomputed_at_payout" }),
    ]);
    expect(events).toEqual(["payout.settlement_created"]);
  });
});
