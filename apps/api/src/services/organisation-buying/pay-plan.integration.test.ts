import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidInvoice, legalEntity, lot, payment } from "@auction/db/schema";
import { InvoiceRaiser } from "@auction/finance-runtime";
import {
  DrizzleAccountPurchaseFactsReader,
  DrizzleBidInvoiceRepository,
  DrizzleLegalEntityMembershipReader,
  DrizzleLegalEntityReader,
  DrizzleLegalEntityRepository,
  DrizzleLotRepository,
  DrizzlePaySeveralInvoiceFlagsReader,
  DrizzlePaymentRepository,
} from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteIdentityUserFixtures,
  seedIdentityUserFixtures,
} from "../../testing/identity-user-fixtures.js";
import { PayPlanService } from "./pay-plan.service.js";
import { PayProgressResolver } from "./pay-progress.resolver.js";
import { PurchaseCandidateReader } from "./purchase-candidate.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/** The Pay page's read, against stored invoices and real purchase facts. */
describe.skipIf(!HAS_DB)("pay plan (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const invoices = new DrizzleBidInvoiceRepository(db);
  const payments = new DrizzlePaymentRepository(db);
  const lots = new DrizzleLotRepository(db);
  const raiser = new InvoiceRaiser({ invoices, sales: null });

  const day = 86_400_000;
  const buyerId = `plan-buyer-${randomUUID()}`;
  const buyerEntity = randomUUID();
  const otherEntity = randomUUID();
  const sellerEntity = randomUUID();
  const lotIds: string[] = [];

  async function newLot(currentPrice: string, forAccount = buyerEntity): Promise<Lot> {
    const id = randomUUID();
    lotIds.push(id);
    await db.insert(lot).values({
      id,
      title: `Plan ${id.slice(0, 6)}`,
      lotNumber: lotIds.length,
      images: [],
      auctionType: "english",
      startingPrice: "100.00",
      currentPrice,
      minBidIncrement: "10.00",
      startTime: new Date(Date.now() - 10 * day),
      endTime: new Date(Date.now() - 2 * day),
      status: "ended",
      sellerLegalEntityId: sellerEntity,
      winnerId: buyerId,
      buyerLegalEntityId: forAccount,
    });
    const found = await lots.findById(id);
    if (!found) throw new Error("lot was not stored");
    return found;
  }

  async function invoiced(l: Lot) {
    return raiser.raise({
      lot: l,
      priced: await raiser.price(l),
      payment: {
        lotId: l.id,
        paidByUserId: buyerId,
        buyerLegalEntityId: buyerEntity,
        sellerLegalEntityId: sellerEntity,
        platformFee: "0.00",
        stripePaymentIntentId: null,
      },
    });
  }

  const service = new PayPlanService({
    delivery: null,
    // Every live group counts as a payment the payer finished.
    progress: new PayProgressResolver({ checkoutStatus: async () => "complete" }),
    candidates: new PurchaseCandidateReader({
      reader: new DrizzleAccountPurchaseFactsReader(db),
      flags: new DrizzlePaySeveralInvoiceFlagsReader(db),
      now: () => new Date(),
    }),
    invoices,
    pricing: raiser,
    lots,
    accounts: new DrizzleLegalEntityRepository(
      new DrizzleLegalEntityReader(db),
      new DrizzleLegalEntityMembershipReader(db),
    ),
    onboarding: { isComplete: async () => true },
    eligibility: { check: async () => ({ kind: "payable" as const }) },
    compliance: null,
    limits: {
      minPence: 30,
      cardMaxPence: 1_000_000,
      manualReviewMinPence: 50_000_000,
      absoluteMaxPence: 99_999_999,
    },
    issuer: {
      name: "London Auction Xchange LTD",
      address: "156 New Cavendish Street",
      companyNumber: null,
      vatNumber: null,
    },
    now: () => new Date(),
  });

  const actor = { userId: buyerId, legalEntityId: buyerEntity, role: "owner" as const };

  beforeAll(async () => {
    await seedIdentityUserFixtures(db, [
      { id: buyerId, name: buyerId, email: `${buyerId}@integration.test` },
    ]);
    for (const [id, kind, subkind] of [
      [buyerEntity, "individual", "private_collector"],
      [otherEntity, "individual", "private_collector"],
      [sellerEntity, "organisation", "gallery"],
    ] as const) {
      await db.insert(legalEntity).values({
        id,
        displayName: `Plan entity ${id.slice(0, 4)}`,
        kind,
        subkind,
        createdByUserId: buyerId,
        status: "approved",
      });
    }
  });

  afterAll(async () => {
    await db.delete(payment).where(inArray(payment.lotId, lotIds));
    await db.delete(bidInvoice).where(inArray(bidInvoice.lotId, lotIds));
    await db.delete(lot).where(inArray(lot.id, lotIds));
    await db
      .delete(legalEntity)
      .where(inArray(legalEntity.id, [buyerEntity, otherEntity, sellerEntity]));
    await deleteIdentityUserFixtures(db, [buyerId]);
  });

  it("plans from the stored invoices: lines, totals, due date, and what is left out", async () => {
    const due = await newLot("1000.00");
    const dueRaised = await invoiced(due);
    const paid = await newLot("500.00");
    const paidRaised = await invoiced(paid);
    await payments.updateStatus(paidRaised.payment.id, "captured");
    const notInvoiced = await newLot("200.00");
    const elsewhere = await newLot("300.00", otherEntity);
    const voided = await newLot("400.00");
    const voidedRaised = await invoiced(voided);
    await payments.updateStatus(voidedRaised.payment.id, "cancelled");
    await db
      .update(bidInvoice)
      .set({ voidedAt: new Date() })
      .where(eq(bidInvoice.id, voidedRaised.invoice.id));

    // The invoice's lot price is edited after it was raised: the plan still reads the stored lines.
    await db.update(lot).set({ currentPrice: "9999.00" }).where(eq(lot.id, due.id));

    const result = await service.plan(actor, [
      due.id,
      paid.id,
      notInvoiced.id,
      elsewhere.id,
      voided.id,
    ]);
    const plan = result._unsafeUnwrap();

    expect(plan.gate).toEqual({ kind: "clear" });
    expect(plan.account).toMatchObject({ legalEntityId: buyerEntity, kind: "individual" });
    expect(plan.payable.map((p) => [p.lotId, p.paymentId, p.totalPence])).toEqual([
      [due.id, dueRaised.payment.id, 125_000],
      [notInvoiced.id, null, 25_000],
    ]);
    expect(plan.payable[0]?.lines.map((l) => [l.kind, l.amountPence])).toEqual([
      ["hammer", 100_000],
      ["buyers_premium", 25_000],
    ]);
    expect(plan.payable[0]?.dueAt).toBe(dueRaised.invoice.dueAt.toISOString());
    expect(plan.leftOut).toEqual([
      { lotId: paid.id, reason: "paid" },
      { lotId: elsewhere.id, reason: "other_account" },
      { lotId: voided.id, reason: "voided" },
    ]);
    expect(plan.totals.pence).toBe(150_000);
    expect(plan.totals.byKind).toEqual([
      { kind: "hammer", pence: 120_000 },
      { kind: "buyers_premium", pence: 30_000 },
    ]);

    // Reading the plan raised nothing: the lot that was not invoiced still has no invoice.
    const raisedForIt = await db
      .select()
      .from(bidInvoice)
      .where(eq(bidInvoice.lotId, notInvoiced.id));
    expect(raisedForIt).toHaveLength(0);
  });
});
