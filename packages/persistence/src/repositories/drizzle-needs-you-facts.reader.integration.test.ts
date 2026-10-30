import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  bid,
  bidIdentityDirectory,
  bidUserProfile,
  buyerAgentAuthorisation,
  consignmentAgreement,
  itemSubmission,
  legalEntity,
  legalEntityMember,
  lot,
  lotFulfilment,
  payment,
  sourceOfFunds,
  user,
  userInvitation,
} from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleNeedsYouFactsReader } from "./drizzle-needs-you-facts.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * One organisation with an owner and a buyer agent, and a rival organisation bidding on the same
 * lots. Each fact reads only the organisation's rows, narrowed as asked. Rolled back at the end.
 */
describe.skipIf(!HAS_DB)("needs-you facts reader (integration)", () => {
  it("reads each fact for the account and the scope only", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const hour = 3_600_000;
    const day = 24 * hour;
    const tag = randomUUID().slice(0, 8);
    const ownerId = `ny-owner-${tag}`;
    const agentId = `ny-agent-${tag}`;
    const rivalId = `ny-rival-${tag}`;
    const orgId = randomUUID();
    const rivalOrgId = randomUUID();
    const id = () => randomUUID();
    const lots = {
      outbid: id(),
      outbidByAgent: id(),
      leading: id(),
      closed: id(),
      unpaid: id(),
      paidNoDelivery: id(),
      inTransit: id(),
      readyToCollect: id(),
      collected: id(),
      agentUnpaid: id(),
    };
    const submissions = { proposed: id(), incomplete: id(), accepted: id(), changes: id() };

    try {
      await db.transaction(async (tx) => {
        for (const [userId, name] of [
          [ownerId, "Olivia Owner"],
          [agentId, "Agnes Agent"],
          [rivalId, "Rita Rival"],
        ] as const) {
          await tx.insert(user).values({
            id: userId,
            name,
            email: `${userId}@integration.test`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(bidUserProfile).values({
            userId,
            kycStatus: userId === agentId ? "pending" : "unverified",
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(bidIdentityDirectory).values({
            subjectId: userId,
            name,
            email: `${userId}@integration.test`,
            identityCreatedAt: now,
          });
        }
        const organisation = (entityId: string, createdBy: string) => ({
          id: entityId,
          displayName: entityId,
          kind: "organisation" as const,
          subkind: "gallery" as const,
          createdByUserId: createdBy,
          status: "approved" as const,
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .insert(legalEntity)
          .values([organisation(orgId, ownerId), organisation(rivalOrgId, rivalId)]);
        await tx.insert(legalEntityMember).values([
          { legalEntityId: orgId, userId: ownerId, role: "owner", acceptedAt: now },
          { legalEntityId: orgId, userId: agentId, role: "buyer_agent", acceptedAt: now },
          { legalEntityId: rivalOrgId, userId: rivalId, role: "owner", acceptedAt: now },
        ]);

        const newLot = (
          lotId: string,
          fields: Partial<typeof lot.$inferInsert>,
        ): typeof lot.$inferInsert => ({
          id: lotId,
          sellerLegalEntityId: rivalOrgId,
          title: lotId,
          auctionType: "english",
          startingPrice: "100.00",
          currentPrice: "1000.00",
          minBidIncrement: "10.00",
          startTime: new Date(now.getTime() - 2 * day),
          endTime: new Date(now.getTime() + 2 * hour),
          status: "active",
          createdAt: now,
          updatedAt: now,
          ...fields,
        });
        const won = (winnerId = ownerId) => ({
          status: "ended" as const,
          endTime: new Date(now.getTime() - day),
          winnerId,
          buyerLegalEntityId: orgId,
        });
        await tx.insert(lot).values([
          newLot(lots.outbid, { title: "Outbid by a rival" }),
          newLot(lots.outbidByAgent, {
            title: "Agent outbid",
            endTime: new Date(now.getTime() + hour),
          }),
          newLot(lots.leading, { title: "Leading" }),
          newLot(lots.closed, { title: "Closed", status: "ended", endTime: new Date(now) }),
          newLot(lots.unpaid, { title: "Unpaid", ...won() }),
          newLot(lots.paidNoDelivery, { title: "Paid, no delivery", ...won() }),
          newLot(lots.inTransit, { title: "In transit", ...won() }),
          newLot(lots.readyToCollect, { title: "Ready to collect", ...won() }),
          newLot(lots.collected, { title: "Collected", ...won() }),
          newLot(lots.agentUnpaid, { title: "Agent unpaid", ...won(agentId) }),
        ]);
        const newBid = (lotId: string, bidderId: string, entityId: string, isWinning: boolean) => ({
          lotId,
          bidderId,
          buyerLegalEntityId: entityId,
          amount: isWinning ? "600.00" : "500.00",
          isWinning,
          createdAt: now,
        });
        await tx
          .insert(bid)
          .values([
            newBid(lots.outbid, ownerId, orgId, false),
            newBid(lots.outbid, rivalId, rivalOrgId, true),
            newBid(lots.outbidByAgent, agentId, orgId, false),
            newBid(lots.outbidByAgent, rivalId, rivalOrgId, true),
            newBid(lots.leading, ownerId, orgId, true),
            newBid(lots.closed, ownerId, orgId, false),
          ]);

        const newPayment = (lotId: string, status: "captured" | "pending") => ({
          id: id(),
          lotId,
          buyerId: ownerId,
          buyerLegalEntityId: orgId,
          sellerLegalEntityId: rivalOrgId,
          amount: "1250.00",
          platformFee: "62.50",
          status,
          createdAt: now,
        });
        const paid = [lots.paidNoDelivery, lots.inTransit, lots.readyToCollect, lots.collected].map(
          (lotId) => newPayment(lotId, "captured"),
        );
        await tx.insert(payment).values([newPayment(lots.unpaid, "pending"), ...paid]);
        await tx.insert(lotFulfilment).values([
          { lotId: lots.inTransit, status: "in_transit", fulfilmentMethod: "shipping" },
          {
            lotId: lots.readyToCollect,
            status: "ready_for_collection",
            fulfilmentMethod: "collection",
          },
          {
            lotId: lots.collected,
            status: "ready_for_collection",
            fulfilmentMethod: "collection",
            collectedAt: now,
          },
        ]);

        const submission = (
          submissionId: string,
          status: "approved" | "changes_requested",
          submittedByUserId: string,
        ) => ({
          id: submissionId,
          legalEntityId: orgId,
          title: submissionId,
          status,
          submittedByUserId,
          changesRequestedNote: status === "changes_requested" ? "Add a photo" : null,
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .insert(itemSubmission)
          .values([
            submission(submissions.proposed, "approved", ownerId),
            submission(submissions.incomplete, "approved", ownerId),
            submission(submissions.accepted, "approved", ownerId),
            submission(submissions.changes, "changes_requested", agentId),
          ]);
        const agreement = (submissionId: string, complete: boolean, accepted: boolean) => ({
          submissionId,
          legalEntityId: orgId,
          termsVersion: "v1",
          estimateLow: "1000.00",
          estimateHigh: "1500.00",
          commissionPercent: complete ? "15.00" : null,
          acceptedAt: accepted ? now : null,
        });
        await tx
          .insert(consignmentAgreement)
          .values([
            agreement(submissions.proposed, true, false),
            agreement(submissions.incomplete, false, false),
            agreement(submissions.accepted, true, true),
          ]);

        const invitation = (
          email: string,
          status: "pending" | "expired" | "accepted",
          expiresAt: Date,
          createdAt: Date,
          entityId = orgId,
        ) => ({
          email,
          targetRole: "client",
          tokenHash: `hash-${randomUUID()}`,
          status,
          expiresAt,
          targetLegalEntityId: entityId,
          targetLegalEntityMemberRole: "viewer",
          createdByUserId: ownerId,
          createdAt,
          updatedAt: createdAt,
        });
        await tx.insert(userInvitation).values([
          // Lapsed two days ago: needs you.
          invitation(
            "sam@x.test",
            "pending",
            new Date(now.getTime() - 2 * day),
            new Date(now.getTime() - 9 * day),
          ),
          // Lapsed, then sent again and still open: nothing to do.
          invitation(
            "lee@x.test",
            "expired",
            new Date(now.getTime() - 3 * day),
            new Date(now.getTime() - 10 * day),
          ),
          invitation(
            "LEE@x.test",
            "pending",
            new Date(now.getTime() + 5 * day),
            new Date(now.getTime() - day),
          ),
          // Lapsed long ago: no longer shown.
          invitation(
            "old@x.test",
            "expired",
            new Date(now.getTime() - 60 * day),
            new Date(now.getTime() - 67 * day),
          ),
          // Another organisation's.
          invitation(
            "sam@x.test",
            "expired",
            new Date(now.getTime() - day),
            new Date(now.getTime() - 8 * day),
            rivalOrgId,
          ),
        ]);

        await tx.insert(buyerAgentAuthorisation).values([
          {
            legalEntityId: orgId,
            userId: agentId,
            validUntil: new Date(now.getTime() + 2 * day),
            createdByUserId: ownerId,
          },
        ]);
        await tx.insert(sourceOfFunds).values({
          userId: ownerId,
          trigger: "manual",
          thresholdAmount: "10000.00",
          exposureAmount: "12000.00",
          documentsRequestedAt: now,
        });

        const reader = new DrizzleNeedsYouFactsReader(tx as never);

        const titles = (rows: { title: string }[]) => rows.map((row) => row.title);
        expect(
          titles(await reader.outbidLots({ legalEntityId: orgId, bidderId: null, now, limit: 10 })),
        ).toEqual(["Agent outbid", "Outbid by a rival"]);
        expect(
          titles(
            await reader.outbidLots({ legalEntityId: orgId, bidderId: agentId, now, limit: 10 }),
          ),
        ).toEqual(["Agent outbid"]);

        const purchases = await reader.openPurchases({
          legalEntityId: orgId,
          winnerId: null,
          limit: 50,
        });
        expect(titles(purchases).sort()).toEqual(
          ["Agent unpaid", "Paid, no delivery", "Ready to collect", "Unpaid"].sort(),
        );
        expect(purchases.find((p) => p.title === "Unpaid")).toMatchObject({
          paymentStatus: "pending",
          fulfilment: null,
        });
        expect(purchases.find((p) => p.title === "Agent unpaid")?.paymentStatus).toBeNull();
        expect(purchases.find((p) => p.title === "Ready to collect")).toMatchObject({
          paymentStatus: "captured",
          fulfilment: { status: "ready_for_collection", method: "collection", collectedAt: null },
        });
        expect(
          titles(
            await reader.openPurchases({ legalEntityId: orgId, winnerId: agentId, limit: 50 }),
          ),
        ).toEqual(["Agent unpaid"]);

        expect(
          await reader.agreementsToAccept({
            legalEntityId: orgId,
            visibleTo: undefined,
            limit: 10,
          }),
        ).toEqual([{ id: submissions.proposed, title: submissions.proposed }]);
        expect(
          await reader.changesRequested({
            legalEntityId: orgId,
            visibleTo: { scope: "own", userId: ownerId },
            limit: 10,
          }),
        ).toEqual([]);
        expect(
          await reader.changesRequested({ legalEntityId: orgId, visibleTo: undefined, limit: 10 }),
        ).toEqual([{ id: submissions.changes, title: submissions.changes, note: "Add a photo" }]);

        const expired = await reader.expiredInvitations({
          legalEntityId: orgId,
          since: new Date(now.getTime() - 30 * day),
          now,
        });
        expect(expired.map((invite) => invite.email)).toEqual(["sam@x.test"]);

        const ending = await reader.endingAuthorisations({
          legalEntityId: orgId,
          userId: null,
          now,
          until: new Date(now.getTime() + 7 * day),
        });
        expect(ending).toEqual([expect.objectContaining({ memberName: "Agnes Agent" })]);
        expect(
          await reader.endingAuthorisations({
            legalEntityId: orgId,
            userId: ownerId,
            now,
            until: new Date(now.getTime() + 7 * day),
          }),
        ).toEqual([]);

        expect(await reader.viewerChecks(ownerId)).toEqual({
          identity: "required",
          sourceOfFundsRequested: true,
        });
        expect(await reader.viewerChecks(agentId)).toEqual({
          identity: "checking",
          sourceOfFundsRequested: false,
        });

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
