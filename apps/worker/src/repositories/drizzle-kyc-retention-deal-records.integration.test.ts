import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  itemSubmission,
  kycWatchlistScreening,
  legalEntity,
  marketingEnquiry,
  privateSaleDeal,
  privateSaleDealStageHistory,
  user,
} from "@auction/db/schema";
import {
  DrizzlePartyDealRecordReader,
  DrizzlePrivateSaleDealRepository,
} from "@auction/persistence/repositories";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleKycRetentionLegalEntityStore } from "./drizzle-kyc-retention-legal-entity.store.js";
import { DrizzleKycRetentionPersonStore } from "./drizzle-kyc-retention-person.store.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("the deals a KYC retention subject is a party to (integration)", () => {
  const t = new Date("2026-10-01T00:00:00Z");

  type Ctx = {
    tx: Database;
    sellerId: string;
    buyerId: string;
    secondBuyerId: string;
    sellerEntityId: string;
    buyerEntityId: string;
    dealId: string;
    enquiryCreatedAt: Date;
  };

  /** Seeds a seller, two possible buyers and a deal made from an enquiry; always rolled back. */
  async function withDeal(scenario: (ctx: Ctx) => Promise<void>) {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const suffix = randomUUID().slice(0, 8);
    const ids = {
      sellerId: `kd-seller-${suffix}`,
      buyerId: `kd-buyer-${suffix}`,
      secondBuyerId: `kd-buyer2-${suffix}`,
    };
    try {
      await db.transaction(async (tx) => {
        for (const id of Object.values(ids)) {
          await tx.insert(user).values({
            id,
            name: id,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
        }
        const entities: string[] = [];
        for (const owner of [ids.sellerId, ids.buyerId]) {
          const [entity] = await tx
            .insert(legalEntity)
            .values({
              displayName: `Entity ${owner}`,
              kind: "organisation",
              subkind: "company",
              createdByUserId: owner,
              status: "approved",
              createdAt: t,
              updatedAt: t,
            })
            .returning({ id: legalEntity.id });
          entities.push(entity?.id as string);
        }
        const [work] = await tx
          .insert(itemSubmission)
          .values({
            legalEntityId: entities[0] as string,
            title: "Retention test work",
            status: "draft",
            submittedByUserId: ids.sellerId,
          })
          .returning({ id: itemSubmission.id });
        const [enquiry] = await tx
          .insert(marketingEnquiry)
          .values({
            topic: "selling",
            name: "Ada",
            email: `${ids.sellerId}@example.com`,
            message: "A painting",
            intent: "private_sale_sell",
            status: "converted",
          } as never)
          .returning();
        const deal = await new DrizzlePrivateSaleDealRepository(tx as never).create({
          itemSubmissionId: work?.id as string,
          sourceEnquiryId: enquiry?.id as string,
          ownerUserId: ids.sellerId,
          seller: { legalEntityId: entities[0] as string, actingUserId: ids.sellerId },
          buyer: { legalEntityId: entities[1] as string, actingUserId: ids.buyerId },
          buyerFeeBps: 0,
          sellerCommissionBps: null,
          actorUserId: ids.sellerId,
        });
        await scenario({
          tx: tx as never,
          ...ids,
          sellerEntityId: entities[0] as string,
          buyerEntityId: entities[1] as string,
          dealId: deal.id,
          enquiryCreatedAt: enquiry?.createdAt as Date,
        });
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  it("lists the deals a person is on, as open records", async () => {
    await withDeal(async ({ tx, sellerId, buyerId }) => {
      const store = new DrizzleKycRetentionPersonStore(tx, new DrizzlePartyDealRecordReader(tx));
      for (const id of [sellerId, buyerId]) {
        expect(await store.dealRecords(id)).toMatchObject([
          {
            reference: expect.stringMatching(/^PS-\d{4,}$/),
            stage: "proposed",
            agreedAt: null,
            endedAt: null,
            hasComplianceCase: false,
          },
        ]);
      }
    });
  });

  it("lists the deal for a buyer who was named and then replaced, from the party history", async () => {
    await withDeal(async ({ tx, secondBuyerId, buyerId, dealId, buyerEntityId }) => {
      const deals = new DrizzlePrivateSaleDealRepository(tx as never);
      const current = await deals.findById(dealId);
      await deals.setParty(dealId, current?.version as number, {
        role: "buyer",
        legalEntityId: buyerEntityId,
        actingUserId: secondBuyerId,
      });
      const store = new DrizzleKycRetentionPersonStore(tx, new DrizzlePartyDealRecordReader(tx));
      // The replaced buyer is no longer a current party, but was named on the deal.
      expect(await store.dealRecords(buyerId)).toHaveLength(1);
      expect(await store.dealRecords(secondBuyerId)).toHaveLength(1);
    });
  });

  it("lists nothing for someone who was never on a deal", async () => {
    await withDeal(async ({ tx }) => {
      expect(
        await new DrizzleKycRetentionPersonStore(
          tx,
          new DrizzlePartyDealRecordReader(tx),
        ).dealRecords("kd-nobody"),
      ).toEqual([]);
    });
  });

  it("counts a check created since the enquiry for a deal cancelled before agreement", async () => {
    await withDeal(async ({ tx, buyerId, dealId }) => {
      await tx
        .update(privateSaleDeal)
        .set({ stage: "cancelled", cancelReason: "Withdrawn", cancelledAt: new Date() })
        .where(eq(privateSaleDeal.id, dealId));
      const store = new DrizzleKycRetentionPersonStore(tx, new DrizzlePartyDealRecordReader(tx));
      expect(await store.dealRecords(buyerId)).toMatchObject([
        { stage: "cancelled", agreedAt: null, hasComplianceCase: false },
      ]);
      await tx.insert(kycWatchlistScreening).values({
        userId: buyerId,
        providerSessionId: `session-${buyerId}`,
        matchStatus: "no_match",
        decisionOutcome: "clear",
        screenedAt: new Date(),
      } as never);
      expect(await store.dealRecords(buyerId)).toMatchObject([
        { stage: "cancelled", hasComplianceCase: true },
      ]);
    });
  });

  it("reads when a settled deal settled from its stage history", async () => {
    await withDeal(async ({ tx, buyerId, dealId }) => {
      const settledAt = new Date("2026-05-01T00:00:00Z");
      await tx
        .update(privateSaleDeal)
        .set({
          stage: "settled",
          priceMinor: 100,
          agreedAt: settledAt,
          vatTreatment: "margin_scheme",
          sellerCommissionBps: 1500,
          paymentDueAt: settledAt,
        })
        .where(eq(privateSaleDeal.id, dealId));
      await tx.insert(privateSaleDealStageHistory).values({
        dealId,
        fromStage: "released",
        toStage: "settled",
        createdAt: settledAt,
      });
      expect(
        await new DrizzleKycRetentionPersonStore(
          tx,
          new DrizzlePartyDealRecordReader(tx),
        ).dealRecords(buyerId),
      ).toMatchObject([{ stage: "settled", endedAt: settledAt, agreedAt: settledAt }]);
    });
  });

  it("dates a settled deal by its last update when no history row says when it settled", async () => {
    await withDeal(async ({ tx, buyerId, dealId }) => {
      const at = new Date("2026-05-01T00:00:00Z");
      await tx
        .update(privateSaleDeal)
        .set({
          stage: "settled",
          priceMinor: 100,
          agreedAt: at,
          vatTreatment: "margin_scheme",
          sellerCommissionBps: 1500,
          paymentDueAt: at,
          updatedAt: at,
        })
        .where(eq(privateSaleDeal.id, dealId));
      const [record] = await new DrizzleKycRetentionPersonStore(
        tx,
        new DrizzlePartyDealRecordReader(tx),
      ).dealRecords(buyerId);
      expect(record?.stage).toBe("settled");
      expect(record?.endedAt).toEqual(at);
    });
  });

  it("does not take evidence created after the deal ended for the deal's own clearance", async () => {
    await withDeal(async ({ tx, buyerId, dealId }) => {
      const cancelledAt = new Date("2026-10-02T00:00:00Z");
      await tx
        .update(privateSaleDeal)
        .set({ stage: "cancelled", cancelReason: "Withdrawn", cancelledAt })
        .where(eq(privateSaleDeal.id, dealId));
      await tx.insert(kycWatchlistScreening).values({
        userId: buyerId,
        providerSessionId: `late-${buyerId}`,
        matchStatus: "no_match",
        decisionOutcome: "clear",
        screenedAt: new Date("2030-01-01T00:00:00Z"),
        createdAt: new Date("2030-01-01T00:00:00Z"),
      } as never);
      expect(
        await new DrizzleKycRetentionPersonStore(
          tx,
          new DrizzlePartyDealRecordReader(tx),
        ).dealRecords(buyerId),
      ).toMatchObject([{ stage: "cancelled", hasComplianceCase: false }]);
    });
  });

  it("finds an organisation named on its own, before any person acts for it", async () => {
    await withDeal(async ({ tx, dealId, buyerEntityId }) => {
      const deals = new DrizzlePrivateSaleDealRepository(tx as never);
      const current = await deals.findById(dealId);
      // The buyer is now an organisation with no person; the earlier buyer person is replaced.
      await deals.setParty(dealId, current?.version as number, {
        role: "buyer",
        legalEntityId: buyerEntityId,
        actingUserId: null,
      });
      const store = new DrizzleKycRetentionLegalEntityStore(
        tx,
        new DrizzlePartyDealRecordReader(tx),
      );
      expect(await store.dealRecords(buyerEntityId)).toHaveLength(1);
    });
  });

  it("lists the deals an organisation is a party to", async () => {
    await withDeal(async ({ tx, sellerEntityId, buyerEntityId }) => {
      const store = new DrizzleKycRetentionLegalEntityStore(
        tx,
        new DrizzlePartyDealRecordReader(tx),
      );
      expect(await store.dealRecords(sellerEntityId)).toHaveLength(1);
      expect(await store.dealRecords(buyerEntityId)).toHaveLength(1);
      expect(await store.dealRecords(randomUUID())).toEqual([]);
    });
  });
});
