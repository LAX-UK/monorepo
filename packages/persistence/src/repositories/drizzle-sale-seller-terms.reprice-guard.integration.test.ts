import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  consignmentAgreement,
  itemSubmission,
  legalEntity,
  lot,
  payment,
  saleSellerTerms,
  user,
} from "@auction/db/schema";
import type { SellerTermsSnapshot } from "@auction/domain";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleSaleSellerTermsStore } from "./drizzle-sale-seller-terms.store.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * `repriceHeld` only ever prices a held row again. A snapshot that is already priced (by a payout
 * run or a recording that got there first) is left exactly as it was and handed back, so the
 * caller sees what the sale is really paid on. Rolled back.
 */
describe.skipIf(!HAS_DB)(
  "seller terms store: only a held row is priced again (integration)",
  () => {
    async function inRolledBackTx(work: (tx: Database, ids: Seeded) => Promise<void>) {
      // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
      const db = createDb(process.env.DATABASE_URL!);
      const rollback = new Error("rollback_test_tx");
      try {
        await db.transaction(async (tx) => {
          const conn = tx as unknown as Database;
          await work(conn, await seed(conn));
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    }

    type Seeded = { lotId: string; seller: string; paymentId: string; agreementId: string };

    async function seed(tx: Database): Promise<Seeded> {
      const tag = randomUUID().slice(0, 8);
      const buyerId = `reprice-buyer-${tag}`;
      const now = new Date();
      await tx.insert(user).values({
        id: buyerId,
        name: "Fixture Buyer",
        email: `${buyerId}@integration.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      const seller = randomUUID();
      const buyer = randomUUID();
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
      const lotId = randomUUID();
      await tx.insert(lot).values({
        id: lotId,
        title: `Reprice ${tag}`,
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
        })
        .returning({ id: payment.id });
      if (!paid) throw new Error("payment not stored");
      const submissionId = randomUUID();
      await tx.insert(itemSubmission).values({
        id: submissionId,
        legalEntityId: seller,
        title: "Consigned work",
        convertedLotId: lotId,
      });
      const [agreement] = await tx
        .insert(consignmentAgreement)
        .values({
          submissionId,
          legalEntityId: seller,
          termsVersion: "v1",
          commissionPercent: "15.00",
          acceptedAt: new Date("2026-10-01T10:00:00Z"),
        })
        .returning({ id: consignmentAgreement.id });
      if (!agreement) throw new Error("agreement not stored");
      return { lotId, seller, paymentId: paid.id, agreementId: agreement.id };
    }

    const base = (s: Seeded) => ({
      paymentId: s.paymentId,
      lotId: s.lotId,
      sellerLegalEntityId: s.seller,
      hammerPence: 620_000,
      premiumPence: 155_000,
      ruleVersion: "agreement_hammer_v1",
    });

    const pricedOnTwelvePercent = (s: Seeded): SellerTermsSnapshot => ({
      lotId: s.lotId,
      sellerLegalEntityId: s.seller,
      hammerPence: 620_000,
      premiumPence: 155_000,
      ruleVersion: "agreement_hammer_v1",
      basis: "agreement",
      agreementId: s.agreementId,
      commissionBps: 1200,
      commissionPence: 74_400,
      commissionVatTreatment: "standard",
      commissionVatBps: 2000,
      commissionVatPence: 14_880,
      otherCharges: [],
      sellerNetPence: 530_720,
    });

    it("leaves a row priced on an agreement as it is and returns it", async () => {
      await inRolledBackTx(async (tx, s) => {
        const [priced] = await tx
          .insert(saleSellerTerms)
          .values({
            ...base(s),
            basis: "agreement",
            agreementId: s.agreementId,
            commissionBps: 1500,
            commissionPence: 93_000,
            commissionVatTreatment: "standard",
            commissionVatBps: 2000,
            commissionVatPence: 18_600,
            sellerNetPence: 508_400,
          })
          .returning();
        if (!priced) throw new Error("terms not stored");

        const store = new DrizzleSaleSellerTermsStore(tx);
        const returned = await store.repriceHeld(
          priced.id,
          pricedOnTwelvePercent(s),
          "agreement_recorded",
        );

        expect(returned.id).toBe(priced.id);
        expect(returned.snapshot).toMatchObject({
          basis: "agreement",
          commissionBps: 1500,
          sellerNetPence: 508_400,
        });
        const [after] = await tx
          .select()
          .from(saleSellerTerms)
          .where(eq(saleSellerTerms.id, priced.id));
        expect(after).toEqual(priced);
      });
    });

    it("leaves LAX's own stock as it is", async () => {
      await inRolledBackTx(async (tx, s) => {
        const [owned] = await tx
          .insert(saleSellerTerms)
          .values({ ...base(s), basis: "lax_owned" })
          .returning();
        if (!owned) throw new Error("terms not stored");
        const returned = await new DrizzleSaleSellerTermsStore(tx).repriceHeld(
          owned.id,
          pricedOnTwelvePercent(s),
        );
        expect(returned.snapshot.basis).toBe("lax_owned");
        const [after] = await tx
          .select()
          .from(saleSellerTerms)
          .where(eq(saleSellerTerms.id, owned.id));
        expect(after).toEqual(owned);
      });
    });

    it("prices a held row again", async () => {
      await inRolledBackTx(async (tx, s) => {
        const [held] = await tx
          .insert(saleSellerTerms)
          .values({ ...base(s), basis: "held", heldReason: "no_agreement" })
          .returning();
        if (!held) throw new Error("terms not stored");
        const returned = await new DrizzleSaleSellerTermsStore(tx).repriceHeld(
          held.id,
          pricedOnTwelvePercent(s),
          "agreement_recorded",
        );
        expect(returned.snapshot).toMatchObject({ basis: "agreement", sellerNetPence: 530_720 });
      });
    });
  },
);
