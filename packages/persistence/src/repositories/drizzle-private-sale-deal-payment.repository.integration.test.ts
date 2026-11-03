import { type Database, createDb } from "@auction/db";
import { itemSubmission, legalEntity, payout, privateSaleDeal, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzlePayoutRepository } from "./drizzle-payout.repository.js";
import {
  DrizzlePrivateSaleDealFinanceStore,
  DrizzlePrivateSaleDealPaymentRepository,
  DrizzlePrivateSaleDealPayoutStore,
} from "./drizzle-private-sale-deal-payment.repository.js";
import { DrizzlePrivateSaleDealRepository } from "./drizzle-private-sale-deal.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("private sale deal payments and payouts (integration)", () => {
  const staffId = "psp-it-staff";
  const sellerUserId = "psp-it-seller";
  const buyerUserId = "psp-it-buyer";
  const sellerEntityId = "a0e00000-0000-4000-8000-0000000000a1";
  const buyerEntityId = "a0e00000-0000-4000-8000-0000000000a2";
  const t = new Date("2026-10-01T00:00:00Z");

  /** Runs in a transaction that is always rolled back. */
  async function inRollback(run: (db: Database, dealId: string) => Promise<void>) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_private_sale_payment_test");
    try {
      await db.transaction(async (tx) => {
        for (const id of [staffId, sellerUserId, buyerUserId]) {
          await tx.insert(user).values({
            id,
            name: id,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
        }
        for (const [id, name, owner] of [
          [sellerEntityId, "Henry Lowe", sellerUserId],
          [buyerEntityId, "Marlow Collection Ltd", buyerUserId],
        ] as const) {
          await tx.insert(legalEntity).values({
            id,
            displayName: name,
            kind: "organisation",
            subkind: "company",
            createdByUserId: owner,
            status: "approved",
            createdAt: t,
            updatedAt: t,
          });
        }
        const [submission] = await tx
          .insert(itemSubmission)
          .values({
            legalEntityId: sellerEntityId,
            title: "Low tide at Maldon",
            status: "draft",
            submittedByUserId: sellerUserId,
          })
          .returning({ id: itemSubmission.id });
        const deals = new DrizzlePrivateSaleDealRepository(tx as unknown as Database);
        const deal = await deals.create({
          itemSubmissionId: submission?.id as string,
          ownerUserId: staffId,
          seller: { legalEntityId: sellerEntityId, actingUserId: sellerUserId },
          buyer: { legalEntityId: buyerEntityId, actingUserId: buyerUserId },
          buyerFeeBps: 0,
          sellerCommissionBps: 1500,
          actorUserId: staffId,
        });
        await run(tx as unknown as Database, deal.id);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  const newPayment = (dealId: string) => ({
    dealId,
    buyerLegalEntityId: buyerEntityId,
    createdByUserId: buyerUserId,
    rail: "gb_bank_transfer" as const,
    amountMinor: 4_800_000,
  });

  it("holds a deal with one live payment and hands the same one back on a second claim", async () => {
    await inRollback(async (db, dealId) => {
      const repo = new DrizzlePrivateSaleDealPaymentRepository(db);
      const first = await repo.claim(newPayment(dealId));
      expect(first.kind).toBe("created");
      const second = await repo.claim(newPayment(dealId));
      expect(second).toMatchObject({ kind: "existing", payment: { id: first.payment.id } });
    });
  });

  it("lets the buyer start again after a cancelled checkout", async () => {
    await inRollback(async (db, dealId) => {
      const repo = new DrizzlePrivateSaleDealPaymentRepository(db);
      const first = await repo.claim(newPayment(dealId));
      expect(await repo.markCancelled(first.payment.id)).toMatchObject({ status: "cancelled" });
      const again = await repo.claim(newPayment(dealId));
      expect(again.kind).toBe("created");
      expect(again.payment.id).not.toBe(first.payment.id);
    });
  });

  it("applies each move only from the statuses that may make it", async () => {
    await inRollback(async (db, dealId) => {
      const repo = new DrizzlePrivateSaleDealPaymentRepository(db);
      const { payment } = await repo.claim(newPayment(dealId));
      const at = new Date("2026-11-04T09:00:00Z");
      expect(
        await repo.markRefunded(payment.id, { refundedMinor: 1, refundId: null, at }),
      ).toBeNull();
      expect(await repo.markProcessing(payment.id)).toMatchObject({ status: "processing" });
      expect(await repo.markProcessing(payment.id)).toBeNull();
      const paid = await repo.markPaid(payment.id, {
        chargeId: "ch_1",
        paymentIntentId: "pi_1",
        at,
      });
      expect(paid).toMatchObject({ status: "paid", stripeChargeId: "ch_1", paidAt: at });
      expect(
        await repo.markPaid(payment.id, { chargeId: "ch_1", paymentIntentId: "pi_1", at }),
      ).toBeNull();
      expect(await repo.markCancelled(payment.id)).toBeNull();
      expect((await repo.findByChargeId("ch_1"))?.id).toBe(payment.id);
      const refunded = await repo.markRefunded(payment.id, {
        refundedMinor: 4_800_000,
        refundId: "re_1",
        at,
      });
      expect(refunded).toMatchObject({ status: "refunded", refundedMinor: 4_800_000 });
    });
  });

  it("records the invoice reference and sums the buyer's other open deals", async () => {
    await inRollback(async (db, dealId) => {
      const finance = new DrizzlePrivateSaleDealFinanceStore(db);
      await finance.recordInvoiceReference(dealId, "INV-1042");
      const [row] = await db.select().from(privateSaleDeal).where(eq(privateSaleDeal.id, dealId));
      expect(row?.invoiceReference).toBe("INV-1042");
      expect(await finance.sumOtherOpenExposureMinor(buyerEntityId, dealId)).toBe(0);
    });
  });

  it("offers a released, paid deal to the payout run once, and settles it when the payout is paid", async () => {
    await inRollback(async (db, dealId) => {
      const payments = new DrizzlePrivateSaleDealPaymentRepository(db);
      const store = new DrizzlePrivateSaleDealPayoutStore(db);
      const payouts = new DrizzlePayoutRepository(db);
      await db
        .update(privateSaleDeal)
        .set({ priceMinor: 4_800_000, costsMinor: 25_000, agreedAt: t, stage: "released" })
        .where(eq(privateSaleDeal.id, dealId));
      // Held until the buyer's money is in.
      expect(await store.findUnsettledReleased(sellerEntityId)).toEqual([]);
      const { payment } = await payments.claim(newPayment(dealId));
      await payments.markPaid(payment.id, { chargeId: "ch_2", paymentIntentId: null, at: t });

      const [deal] = await store.findUnsettledReleased(sellerEntityId);
      expect(deal).toMatchObject({ dealId, priceMinor: 4_800_000, sellerCommissionBps: 1500 });
      expect(await store.listSellerLegalEntityIdsWithUnsettledReleased()).toContain(sellerEntityId);

      const created = await payouts.create({
        legalEntityId: sellerEntityId,
        periodStart: new Date(0),
        periodEnd: new Date(),
        grossAmount: "48000.00",
        platformFee: "7450.00",
        stripeFee: "0.00",
        netAmount: "40550.00",
        currency: "GBP",
      });
      const line = await store.insertSaleLine({
        payoutId: created.id,
        dealId,
        amount: "48000.00",
      });
      expect(line).toMatchObject({ privateSaleDealId: dealId, kind: "sale" });
      expect(
        await store.insertSaleLine({ payoutId: created.id, dealId, amount: "48000.00" }),
      ).toBeNull();
      expect(await store.hasPayoutLine(dealId)).toBe(true);
      expect(await store.findUnsettledReleased(sellerEntityId)).toEqual([]);

      const lines = await payouts.listLines(created.id);
      expect(lines[0]?.payment).toEqual({ amount: "48000.00", platformFee: "7450.00" });

      expect(await store.listReleasedWithPaidPayout(10)).toEqual([]);
      await db
        .update(payout)
        .set({ status: "paid", processedAt: t })
        .where(eq(payout.id, created.id));
      expect(await store.listReleasedWithPaidPayout(10)).toEqual([
        { dealId, payoutId: created.id },
      ]);
    });
  });
});
