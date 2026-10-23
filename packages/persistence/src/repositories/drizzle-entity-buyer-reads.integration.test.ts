import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidUserProfile, legalEntity, lot, payment, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleLotRepository } from "./drizzle-lot.repository.js";
import { DrizzlePaymentRepository } from "./drizzle-payment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * An organisation's wins and payments belong to the buyer entity, not to whichever member
 * placed the bid. Runs in a transaction that is rolled back, so it leaves no rows behind.
 */
describe.skipIf(!HAS_DB)("entity-scoped buyer reads (integration)", () => {
  it("reads payments and lots by buyer entity while the per-person read is unchanged", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const colleagueId = `entity-reads-colleague-${tag}`;
    const meId = `entity-reads-me-${tag}`;
    const sellerId = `entity-reads-seller-${tag}`;
    const orgId = randomUUID();
    const otherOrgId = randomUUID();
    const personalId = randomUUID();
    const sellerEntityId = randomUUID();
    const wonByColleague = randomUUID();
    const wonByMeForOrg = randomUUID();
    const wonByMePersonally = randomUUID();
    const wonForOtherOrg = randomUUID();
    const unsold = randomUUID();

    try {
      await db.transaction(async (tx) => {
        for (const id of [colleagueId, meId, sellerId]) {
          await tx.insert(user).values({
            id,
            name: id,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(bidUserProfile).values({ userId: id, createdAt: now, updatedAt: now });
        }
        const entity = (id: string, kind: "individual" | "organisation", createdBy: string) => ({
          id,
          displayName: id,
          kind,
          subkind: kind === "individual" ? ("private_collector" as const) : ("gallery" as const),
          createdByUserId: createdBy,
          status: "approved" as const,
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .insert(legalEntity)
          .values([
            entity(orgId, "organisation", colleagueId),
            entity(otherOrgId, "organisation", colleagueId),
            entity(personalId, "individual", meId),
            entity(sellerEntityId, "organisation", sellerId),
          ]);

        const newLot = (
          id: string,
          buyerLegalEntityId: string | null,
          winnerId: string | null,
        ) => ({
          id,
          sellerLegalEntityId: sellerEntityId,
          title: `Lot ${id.slice(0, 4)}`,
          images: [],
          auctionType: "english" as const,
          startingPrice: "100.00",
          currentPrice: "250.00",
          minBidIncrement: "10.00",
          startTime: new Date(now.getTime() - 86_400_000),
          endTime: new Date(now.getTime() - 3_600_000),
          status: "ended" as const,
          winnerId,
          buyerLegalEntityId,
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .insert(lot)
          .values([
            newLot(wonByColleague, orgId, colleagueId),
            newLot(wonByMeForOrg, orgId, meId),
            newLot(wonByMePersonally, personalId, meId),
            newLot(wonForOtherOrg, otherOrgId, colleagueId),
            newLot(unsold, null, null),
          ]);

        const newPayment = (
          lotId: string,
          buyerId: string,
          buyerLegalEntityId: string,
          createdAt: Date,
        ) => ({
          lotId,
          buyerId,
          buyerLegalEntityId,
          sellerLegalEntityId: sellerEntityId,
          amount: "250.00",
          platformFee: "25.00",
          createdAt,
        });
        await tx
          .insert(payment)
          .values([
            newPayment(wonByColleague, colleagueId, orgId, new Date(now.getTime() - 3000)),
            newPayment(wonByMeForOrg, meId, orgId, new Date(now.getTime() - 2000)),
            newPayment(wonByMePersonally, meId, personalId, new Date(now.getTime() - 1000)),
            newPayment(wonForOtherOrg, colleagueId, otherOrgId, now),
          ]);

        const payments = new DrizzlePaymentRepository(tx);
        const lots = new DrizzleLotRepository(tx);

        // Entity read: both of the organisation's invoices, newest first, whoever bid.
        const orgPayments = await payments.listByBuyerLegalEntityId(orgId);
        expect(orgPayments.map((row) => row.lotId)).toEqual([wonByMeForOrg, wonByColleague]);

        // Person read is untouched: everything this person bought, for any entity.
        const myPayments = await payments.listByBuyerId(meId);
        expect(myPayments.map((row) => row.lotId)).toEqual([wonByMePersonally, wonByMeForOrg]);

        // A different organisation never leaks in.
        const otherPayments = await payments.listByBuyerLegalEntityId(otherOrgId);
        expect(otherPayments.map((row) => row.lotId)).toEqual([wonForOtherOrg]);
        expect(await payments.listByBuyerLegalEntityId(randomUUID())).toEqual([]);

        const orgLots = await lots.list({
          buyerLegalEntityId: orgId,
          statuses: ["ended"],
          sort: "endedDesc",
          resolveImages: false,
          limit: 50,
          offset: 0,
        });
        expect(orgLots.map((row) => row.id).sort()).toEqual([wonByColleague, wonByMeForOrg].sort());

        const paged = await lots.list({
          buyerLegalEntityId: orgId,
          statuses: ["ended"],
          limit: 1,
          offset: 1,
        });
        expect(paged).toHaveLength(1);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
