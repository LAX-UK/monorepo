import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
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
  user,
} from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleStaffPayoutSalesReader } from "./drizzle-staff-payout-sales.reader.js";
import { DrizzleStaffLotSellerProceedsReader } from "./drizzle-staff-seller-proceeds.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The staff read of a lot's seller side against a real database: the snapshot as stored, the
 * premium from the frozen invoice line, the payout it was paid on and the agreement's reference;
 * and a held sale with the submission an agreement would be recorded against. Rolled back.
 */
describe.skipIf(!HAS_DB)("staff lot seller proceeds reader (integration)", () => {
  it("reads a paid sale and a held one as stored", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const buyerId = `proceeds-buyer-${tag}`;
    const seller = randomUUID();
    const buyer = randomUUID();
    const reference = 900_000_000 + Math.floor(Math.random() * 99_000_000);
    const now = new Date();
    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: buyerId,
          name: "Fixture Buyer",
          email: `${buyerId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        for (const [id, name] of [
          [seller, "Fixture Gallery Ltd"],
          [buyer, "Fixture Buyer"],
        ] as const) {
          await tx.insert(legalEntity).values({
            id,
            displayName: name,
            kind: "organisation",
            subkind: "gallery",
            primaryCountry: "GB",
            createdByUserId: buyerId,
          } as typeof legalEntity.$inferInsert);
        }

        async function sale(input: { paidOut: boolean; held: boolean; fixedReference?: boolean }) {
          const lotId = randomUUID();
          await tx.insert(lot).values({
            id: lotId,
            title: `Proceeds ${tag}`,
            images: [],
            auctionType: "english",
            startingPrice: "100.00",
            currentPrice: "6200.00",
            minBidIncrement: "10.00",
            startTime: new Date(Date.now() - 10 * 86_400_000),
            endTime: new Date(Date.now() - 2 * 86_400_000),
            status: "ended",
            sellerLegalEntityId: seller,
            winnerId: buyerId,
            buyerLegalEntityId: buyer,
          });
          const submissionId = randomUUID();
          await tx.insert(itemSubmission).values({
            id: submissionId,
            legalEntityId: seller,
            title: "Consigned work",
            convertedLotId: lotId,
            ...(input.fixedReference ? { referenceNumber: reference } : {}),
          });
          const agreementId = input.held
            ? null
            : ((
                await tx
                  .insert(consignmentAgreement)
                  .values({
                    submissionId,
                    legalEntityId: seller,
                    termsVersion: "v1",
                    commissionPercent: "12.00",
                    acceptedAt: new Date("2026-10-03T10:00:00Z"),
                  })
                  .returning({ id: consignmentAgreement.id })
              )[0]?.id ?? null);
          const [invoice] = await tx
            .insert(bidInvoice)
            .values({
              lotId,
              buyerLegalEntityId: buyer,
              sellerLegalEntityId: seller,
              totalPence: 775_000,
              raisedAt: now,
              dueAt: new Date(Date.now() + 86_400_000),
            })
            .returning({ id: bidInvoice.id });
          if (!invoice) throw new Error("invoice not stored");
          await tx.insert(bidInvoiceLine).values([
            {
              invoiceId: invoice.id,
              position: 1,
              kind: "hammer",
              label: "Hammer",
              amountPence: 620_000,
            },
            {
              invoiceId: invoice.id,
              position: 2,
              kind: "buyers_premium",
              label: "Buyer's premium",
              ratePercent: "25.000",
              amountPence: 155_000,
            },
          ]);
          const [paid] = await tx
            .insert(payment)
            .values({
              lotId,
              buyerId,
              buyerLegalEntityId: buyer,
              sellerLegalEntityId: seller,
              amount: "7750.00",
              platformFee: "0.00",
              status: "captured",
              invoiceId: invoice.id,
            })
            .returning({ id: payment.id });
          if (!paid) throw new Error("payment not stored");
          const base = {
            paymentId: paid.id,
            lotId,
            sellerLegalEntityId: seller,
            hammerPence: 620_000,
            premiumPence: 155_000,
            ruleVersion: "agreement_hammer_v1",
          };
          const [terms] = await tx
            .insert(saleSellerTerms)
            .values(
              input.held
                ? { ...base, basis: "held", heldReason: "no_agreement" }
                : {
                    ...base,
                    basis: "agreement",
                    agreementId,
                    commissionBps: 1200,
                    commissionPence: 74_400,
                    commissionVatTreatment: "standard",
                    commissionVatBps: 2000,
                    commissionVatPence: 14_880,
                    sellerNetPence: 530_720,
                  },
            )
            .returning({ id: saleSellerTerms.id });
          if (input.paidOut && terms) {
            const [po] = await tx
              .insert(payout)
              .values({
                legalEntityId: seller,
                periodStart: new Date("2026-11-01T00:00:00Z"),
                periodEnd: new Date("2026-11-13T00:00:00Z"),
                grossAmount: "6200.00",
                platformFee: "892.80",
                stripeFee: "0.00",
                netAmount: "5307.20",
                hammerAmount: "6200.00",
                commissionAmount: "744.00",
                commissionVatAmount: "148.80",
                status: "paid",
                processedAt: new Date("2026-11-13T09:00:00Z"),
              } as typeof payout.$inferInsert)
              .returning({ id: payout.id });
            if (!po) throw new Error("payout not stored");
            await tx.insert(payoutLine).values({
              payoutId: po.id,
              paymentId: paid.id,
              kind: "sale",
              amount: "6200.00",
              sellerTermsId: terms.id,
            } as typeof payoutLine.$inferInsert);
          }
          return { lotId, submissionId, paymentId: paid.id };
        }

        const paid = await sale({ paidOut: true, held: false, fixedReference: true });
        const held = await sale({ paidOut: false, held: true });
        const reader = new DrizzleStaffLotSellerProceedsReader(tx as unknown as Database);

        const paidFacts = await reader.forLot(paid.lotId);
        expect(paidFacts?.sellerName).toBe("Fixture Gallery Ltd");
        expect(paidFacts?.sale?.terms).toMatchObject({
          basis: "agreement",
          commissionBps: 1200,
          commissionPence: 74_400,
          commissionVatPence: 14_880,
          sellerNetPence: 530_720,
        });
        expect(paidFacts?.sale?.invoice).toEqual({
          totalPence: 775_000,
          premiumPence: 155_000,
          premiumRatePercent: "25.000",
        });
        expect(paidFacts?.sale?.payout).toMatchObject({ status: "paid" });
        expect(paidFacts?.sale?.refundedAfterPayout).toBe(false);
        expect(paidFacts?.agreement).toMatchObject({
          reference: `C-${reference}`,
          submissionId: paid.submissionId,
          source: "online",
        });

        const heldFacts = await reader.forLot(held.lotId);
        expect(heldFacts?.sale?.terms).toMatchObject({ basis: "held", heldReason: "no_agreement" });
        expect(heldFacts?.sale?.payout).toBeNull();
        expect(heldFacts?.agreement).toBeNull();
        expect(heldFacts?.submissionId).toBe(held.submissionId);

        expect(await reader.forLot(randomUUID())).toBeNull();

        const labels = await reader.saleLabels([paid.lotId, held.lotId, paid.lotId]);
        expect(labels).toHaveLength(2);
        expect(labels.find((l) => l.lotId === paid.lotId)?.agreement).toMatchObject({
          reference: `C-${reference}`,
          submissionId: paid.submissionId,
        });
        expect(labels.find((l) => l.lotId === held.lotId)?.agreement).toBeNull();
        expect(await reader.saleLabels([])).toEqual([]);

        // A sale paid before the rule: its line pays the buyer's payment, with no snapshot.
        const old = await sale({ paidOut: false, held: false });
        const [oldPayout] = await tx
          .insert(payout)
          .values({
            legalEntityId: seller,
            periodStart: new Date("2026-09-01T00:00:00Z"),
            periodEnd: new Date("2026-09-30T00:00:00Z"),
            grossAmount: "7750.00",
            platformFee: "0.00",
            stripeFee: "0.00",
            netAmount: "7750.00",
            status: "paid",
            processedAt: new Date("2026-10-01T09:00:00Z"),
          } as typeof payout.$inferInsert)
          .returning({ id: payout.id });
        if (!oldPayout) throw new Error("payout not stored");
        await tx.insert(payoutLine).values({
          payoutId: oldPayout.id,
          paymentId: old.paymentId,
          kind: "sale",
          amount: "7750.00",
        } as typeof payoutLine.$inferInsert);

        const payouts = new DrizzleStaffPayoutSalesReader(tx as unknown as Database);
        const paidPayoutId = paidFacts?.sale?.payout?.id as string;
        const onPayout = await payouts.forPayout(paidPayoutId);
        expect(onPayout?.payout).toMatchObject({ hammerAmount: "6200.00", status: "paid" });
        expect(onPayout?.sales).toHaveLength(1);
        expect(onPayout?.sales[0]).toMatchObject({
          lotId: paid.lotId,
          terms: { commissionBps: 1200, sellerNetPence: 530_720 },
          oldRule: null,
          agreement: { reference: `C-${reference}` },
        });
        expect(onPayout?.heldForSeller.map((h) => h.lotId)).toEqual([held.lotId]);
        expect(paidFacts?.agreement?.pricedOnEarlierVersion).toBe(false);
        expect(onPayout?.sales[0]?.agreement?.pricedOnEarlierVersion).toBe(false);

        // An Administrator corrects the agreement the sale was paid on: the sale keeps its
        // snapshot's 12%, and both screens say it was priced on an earlier version.
        await tx
          .update(consignmentAgreement)
          .set({ commissionPercent: "15.00", updatedAt: new Date(Date.now() + 1000) })
          .where(eq(consignmentAgreement.submissionId, paid.submissionId));
        const corrected = await reader.forLot(paid.lotId);
        expect(corrected?.sale?.terms?.commissionBps).toBe(1200);
        expect(corrected?.agreement).toMatchObject({
          commissionPercent: "15.00",
          pricedOnEarlierVersion: true,
        });
        const correctedLine = (await payouts.forPayout(paidPayoutId))?.sales[0];
        expect(correctedLine?.terms?.commissionBps).toBe(1200);
        expect(correctedLine?.agreement?.pricedOnEarlierVersion).toBe(true);

        const oldOne = await payouts.forPayout(oldPayout.id);
        expect(oldOne?.payout.hammerAmount).toBeNull();
        expect(oldOne?.sales[0]).toMatchObject({
          terms: null,
          oldRule: { paymentAmount: "7750.00", platformFee: "0.00" },
        });

        const review = await payouts.oldRuleSales({ limit: 500, offset: 0 });
        const mine = review.rows.filter((row) => row.legalEntityId === seller);
        expect(mine).toHaveLength(1);
        expect(mine[0]).toMatchObject({
          lotId: old.lotId,
          hammerPence: 620_000,
          sellerName: "Fixture Gallery Ltd",
          agreement: { commissionPercent: "12.00" },
        });
        expect(review.total).toBeGreaterThanOrEqual(1);
        expect(await payouts.forPayout(randomUUID())).toBeNull();
        const everyHeld = await payouts.heldSales(500);
        expect(everyHeld.find((h) => h.lotId === held.lotId)).toMatchObject({
          sellerName: "Fixture Gallery Ltd",
          heldReason: "no_agreement",
          hammerPence: 620_000,
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
