import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  artistProfile,
  bid,
  bidIdentityDirectory,
  bidUserProfile,
  itemSubmission,
  legalEntity,
  legalEntityMember,
  lot,
  payment,
  paymentExternalRef,
  sale,
  user,
} from "@auction/db/schema";
import { accountSearchTerms } from "@auction/domain";
import { describe, expect, it } from "vitest";
import type { AccountSearchCriteria } from "../interfaces/account-record-search.reader.js";
import { DrizzleAccountRecordSearchReader } from "./drizzle-account-record-search.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * One organisation with an owner, a consignor and a buyer agent, and a second organisation whose
 * records share the same words. Every group finds only the organisation's rows, narrowed by the
 * scope it is given. Runs in a transaction that is rolled back.
 */
describe.skipIf(!HAS_DB)("account record search reader (integration)", () => {
  it("finds each group's records inside the account and the scope only", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const hour = 3_600_000;
    const tag = randomUUID().slice(0, 8);
    const ownerId = `search-owner-${tag}`;
    const consignorId = `search-consignor-${tag}`;
    const agentId = `search-agent-${tag}`;
    const strangerId = `search-stranger-${tag}`;
    const orgId = randomUUID();
    const otherOrgId = randomUUID();
    const artistId = randomUUID();
    const saleId = randomUUID();
    const ids = {
      ownSubmission: randomUUID(),
      consignorSubmission: randomUUID(),
      otherOrgSubmission: randomUUID(),
      consignedLot: randomUUID(),
      wonByOwner: randomUUID(),
      wonByAgent: randomUUID(),
      wonByOtherOrg: randomUUID(),
      bidOnly: randomUUID(),
      payment: randomUUID(),
      otherPayment: randomUUID(),
    };

    try {
      await db.transaction(async (tx) => {
        for (const [id, name] of [
          [ownerId, "Olivia Owner"],
          [consignorId, "Connor Hockney-Fan"],
          [agentId, "Agnes Agent"],
          [strangerId, "Stella Stranger"],
        ] as const) {
          await tx.insert(user).values({
            id,
            name,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(bidUserProfile).values({ userId: id, createdAt: now, updatedAt: now });
          await tx.insert(bidIdentityDirectory).values({
            subjectId: id,
            name,
            email: `${id}@integration.test`,
            identityCreatedAt: now,
          });
        }
        const organisation = (id: string, createdBy: string) => ({
          id,
          displayName: id,
          kind: "organisation" as const,
          subkind: "gallery" as const,
          createdByUserId: createdBy,
          status: "approved" as const,
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .insert(legalEntity)
          .values([organisation(orgId, ownerId), organisation(otherOrgId, strangerId)]);
        await tx.insert(legalEntityMember).values([
          { legalEntityId: orgId, userId: ownerId, role: "owner", acceptedAt: now },
          { legalEntityId: orgId, userId: consignorId, role: "consignor", acceptedAt: now },
          { legalEntityId: orgId, userId: agentId, role: "buyer_agent", acceptedAt: now },
          { legalEntityId: otherOrgId, userId: strangerId, role: "owner", acceptedAt: now },
        ]);
        await tx
          .insert(artistProfile)
          .values({ id: artistId, displayName: "David Hockney", slug: `hockney-${tag}` });
        await tx.insert(sale).values({
          id: saleId,
          title: "Modern British",
          createdByLegalEntityId: otherOrgId,
          startTime: new Date(now.getTime() - 48 * hour),
          endTime: new Date(now.getTime() - hour),
        });

        const newLot = (
          id: string,
          fields: Partial<typeof lot.$inferInsert> & { sellerLegalEntityId: string },
        ): typeof lot.$inferInsert => ({
          id,
          title: "Untitled",
          auctionType: "english",
          startingPrice: "100.00",
          currentPrice: "1000.00",
          minBidIncrement: "10.00",
          startTime: new Date(now.getTime() - 48 * hour),
          endTime: new Date(now.getTime() - hour),
          status: "ended",
          createdAt: now,
          updatedAt: now,
          ...fields,
        });
        await tx.insert(lot).values([
          newLot(ids.consignedLot, {
            sellerLegalEntityId: orgId,
            saleId,
            lotNumber: 12,
            artistId,
            title: "A Bigger Splash (study)",
            status: "active",
            endTime: new Date(now.getTime() + hour),
          }),
          newLot(ids.wonByOwner, {
            sellerLegalEntityId: otherOrgId,
            saleId,
            lotNumber: 3,
            artistId,
            title: "Pool with two figures",
            winnerId: ownerId,
            buyerLegalEntityId: orgId,
          }),
          newLot(ids.wonByAgent, {
            sellerLegalEntityId: otherOrgId,
            title: "Hockney print",
            winnerId: agentId,
            buyerLegalEntityId: orgId,
          }),
          newLot(ids.wonByOtherOrg, {
            sellerLegalEntityId: orgId,
            title: "Hockney elsewhere",
            winnerId: strangerId,
            buyerLegalEntityId: otherOrgId,
          }),
          newLot(ids.bidOnly, {
            sellerLegalEntityId: otherOrgId,
            title: "Hockney still open",
            status: "active",
            endTime: new Date(now.getTime() + hour),
          }),
        ]);

        const submission = (
          id: string,
          legalEntityId: string,
          title: string,
          submittedByUserId: string | null,
          convertedLotId: string | null = null,
        ) => ({
          id,
          legalEntityId,
          title,
          status: (convertedLotId ? "converted" : "submitted") as "converted" | "submitted",
          submittedByUserId,
          convertedLotId,
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .insert(itemSubmission)
          .values([
            submission(ids.ownSubmission, orgId, "Splash", ownerId, ids.consignedLot),
            submission(ids.consignorSubmission, orgId, "Hockney sketch", consignorId),
            submission(ids.otherOrgSubmission, otherOrgId, "Hockney sketch", strangerId),
          ]);

        const newBid = (lotId: string, bidderId: string, legalEntityId: string) => ({
          lotId,
          bidderId,
          buyerLegalEntityId: legalEntityId,
          amount: "500.00",
          createdAt: now,
        });
        await tx
          .insert(bid)
          .values([
            newBid(ids.wonByOwner, ownerId, orgId),
            newBid(ids.wonByAgent, agentId, orgId),
            { ...newBid(ids.bidOnly, agentId, orgId), maxAutoBidAmount: "800.00" },
            newBid(ids.bidOnly, strangerId, otherOrgId),
          ]);

        const newPayment = (id: string, lotId: string, buyerId: string, buyer: string) => ({
          id,
          lotId,
          buyerId,
          buyerLegalEntityId: buyer,
          sellerLegalEntityId: otherOrgId,
          amount: "1250.00",
          platformFee: "62.50",
          status: "captured" as const,
          createdAt: now,
        });
        await tx
          .insert(payment)
          .values([
            newPayment(ids.payment, ids.wonByOwner, ownerId, orgId),
            newPayment(ids.otherPayment, ids.wonByOtherOrg, strangerId, otherOrgId),
          ]);
        await tx.insert(paymentExternalRef).values([
          { paymentId: ids.payment, xeroInvoiceNumber: `INV-${tag}-1` },
          { paymentId: ids.otherPayment, xeroInvoiceNumber: `INV-${tag}-2` },
        ]);

        const reader = new DrizzleAccountRecordSearchReader(tx as never);
        const criteria = <S>(q: string, scope: S, userId = ownerId): AccountSearchCriteria<S> => {
          const terms = accountSearchTerms(q);
          if (!terms) throw new Error(`unsearchable: ${q}`);
          return { legalEntityId: orgId, userId, scope, terms, limit: 10, offset: 0, now };
        };

        // Consignments: by submission title, lot title, artist or lot number; never another org's.
        const all = await reader.consignments(criteria("hockney", "all"));
        expect(all.map((hit) => hit.submissionId).sort()).toEqual(
          [ids.ownSubmission, ids.consignorSubmission].sort(),
        );
        const byLotNumber = await reader.consignments(criteria("Lot 12", "all"));
        expect(byLotNumber).toEqual([
          expect.objectContaining({
            submissionId: ids.ownSubmission,
            lot: expect.objectContaining({
              lotId: ids.consignedLot,
              lotNumber: 12,
              saleTitle: "Modern British",
              artistName: "David Hockney",
            }),
          }),
        ]);
        const consignorOwn = await reader.consignments(criteria("hockney", "own", consignorId));
        expect(consignorOwn.map((hit) => hit.submissionId)).toEqual([ids.consignorSubmission]);

        // Purchases: every win for the account, or one member's own.
        const purchases = await reader.purchases(criteria("hockney", "all"));
        expect(purchases.map((hit) => hit.lotId).sort()).toEqual(
          [ids.wonByOwner, ids.wonByAgent].sort(),
        );
        const agentPurchases = await reader.purchases(criteria("hockney", "own", agentId));
        expect(agentPurchases.map((hit) => hit.lotId)).toEqual([ids.wonByAgent]);
        // The second line: hammer price and where the payment stands.
        const byLot = new Map(purchases.map((hit) => [hit.lotId, hit]));
        expect(byLot.get(ids.wonByOwner)).toMatchObject({
          hammerPrice: "1000.00",
          currency: "GBP",
          paymentState: "paid",
        });
        expect(byLot.get(ids.wonByAgent)).toMatchObject({ paymentState: "due" });
        const later = await reader.purchases({
          ...criteria("hockney", "all"),
          now: new Date(now.getTime() + 8 * 24 * hour),
        });
        expect(later.find((hit) => hit.lotId === ids.wonByAgent)?.paymentState).toBe("overdue");
        expect(await reader.works(criteria("pool", "all"))).toEqual([
          expect.objectContaining({ lotId: ids.wonByOwner, lotNumber: 3, saleId }),
        ]);

        // Bids: lots bid on for the account, once each, never another account's bids.
        const bids = await reader.bids(criteria("hockney", "all"));
        expect(bids.map((hit) => hit.lotId).sort()).toEqual(
          [ids.wonByOwner, ids.wonByAgent, ids.bidOnly].sort(),
        );
        const agentBids = await reader.bids(criteria("hockney", "own", agentId));
        expect(agentBids.map((hit) => hit.lotId).sort()).toEqual(
          [ids.wonByAgent, ids.bidOnly].sort(),
        );
        // The second line: the highest offered in scope and how the lot stands for them.
        const outcomes = new Map(bids.map((hit) => [hit.lotId, [hit.maximum, hit.outcome]]));
        expect(outcomes.get(ids.wonByOwner)).toEqual(["500.00", "won"]);
        expect(outcomes.get(ids.wonByAgent)).toEqual(["500.00", "won"]);
        expect(outcomes.get(ids.bidOnly)).toEqual(["800.00", "outbid"]);
        const agentOutcomes = new Map(agentBids.map((hit) => [hit.lotId, hit.outcome]));
        expect(agentOutcomes.get(ids.bidOnly)).toBe("outbid");
        // The owner's own view of a lot a colleague won for the account: lost for them.
        const ownerOwn = await reader.bids(criteria("hockney", "own", ownerId));
        expect(ownerOwn.map((hit) => [hit.lotId, hit.outcome])).toEqual([[ids.wonByOwner, "won"]]);

        // Invoices: by number or work, only the account's.
        expect(await reader.invoices(criteria(`inv-${tag}`, "all"))).toEqual([
          expect.objectContaining({
            paymentId: ids.payment,
            invoiceNumber: `INV-${tag}-1`,
            title: "Pool with two figures",
            amount: "1250.00",
            currency: "GBP",
          }),
        ]);

        // Members: by name or email, only this organisation's.
        const members = await reader.members(criteria("ag", "all"));
        expect(members.map((hit) => hit.userId)).toEqual([agentId]);
        expect(await reader.members(criteria("stella", "all"))).toEqual([]);

        // Paging: a stable order across pages.
        const first = await reader.bids({ ...criteria("hockney", "all"), limit: 2 });
        const second = await reader.bids({ ...criteria("hockney", "all"), limit: 2, offset: 2 });
        expect(first).toHaveLength(2);
        expect(second).toHaveLength(1);
        expect(new Set([...first, ...second].map((hit) => hit.lotId)).size).toBe(3);

        // Wildcards in the text are matched literally.
        expect(await reader.purchases(criteria("%%", "all"))).toEqual([]);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
