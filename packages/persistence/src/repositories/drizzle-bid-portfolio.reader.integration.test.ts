import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  artistProfile,
  bidUserProfile,
  itemSubmission,
  legalEntity,
  legalEntityMember,
  lot,
  lotFulfilment,
  payment,
  paymentExternalRef,
  payout,
  payoutLine,
  user,
} from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleBidPortfolioReader } from "./drizzle-bid-portfolio.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * The portfolio reads one person's personal entity and nothing else: a win, a consignment, a
 * lot in sale, a closed sale and a payout appear, while organisation records and other
 * people's records never do. Runs in a transaction that is rolled back.
 */
describe.skipIf(!HAS_DB)("bid portfolio reader (integration)", () => {
  it("returns the personal entity's wins, consignments, sales and payouts only", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const meId = `portfolio-me-${tag}`;
    const otherId = `portfolio-other-${tag}`;
    const personalId = randomUUID();
    const otherPersonalId = randomUUID();
    const orgId = randomUUID();
    const artistId = randomUUID();
    const wonPaid = randomUUID();
    const wonUnpaid = randomUUID();
    const wonBilledToOrg = randomUUID();
    const billedToOrgPayment = randomUUID();
    const clawbackPayoutId = randomUUID();
    const wonRefunded = randomUUID();
    const wonForOrg = randomUUID();
    const inSale = randomUUID();
    const soldPaidOut = randomUUID();
    const sellerDraft = randomUUID();
    const sellerNoWinner = randomUUID();
    const orgInSale = randomUUID();
    const paidPayment = randomUUID();
    const refundedPayment = randomUUID();
    const soldPayment = randomUUID();
    const payoutId = randomUUID();
    const otherPayoutId = randomUUID();

    try {
      await db.transaction(async (tx) => {
        for (const id of [meId, otherId]) {
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
            entity(personalId, "individual", meId),
            entity(otherPersonalId, "individual", otherId),
            entity(orgId, "organisation", meId),
          ]);
        await tx.insert(legalEntityMember).values([
          { legalEntityId: personalId, userId: meId, role: "owner", acceptedAt: now },
          { legalEntityId: otherPersonalId, userId: otherId, role: "owner", acceptedAt: now },
          { legalEntityId: orgId, userId: meId, role: "owner", acceptedAt: now },
        ]);
        await tx
          .insert(artistProfile)
          .values({ id: artistId, displayName: "Ada Artist", slug: `ada-${tag}` });

        const hour = 3_600_000;
        const newLot = (
          id: string,
          fields: Partial<typeof lot.$inferInsert> & { sellerLegalEntityId: string },
        ): typeof lot.$inferInsert => ({
          id,
          title: `Lot ${id.slice(0, 4)}`,
          images: [`media/${id.slice(0, 4)}.jpg`, "media/second.jpg"],
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
          // Won by me personally.
          newLot(wonPaid, {
            sellerLegalEntityId: otherPersonalId,
            artistId,
            winnerId: meId,
            buyerLegalEntityId: personalId,
          }),
          newLot(wonUnpaid, {
            sellerLegalEntityId: otherPersonalId,
            winnerId: meId,
            buyerLegalEntityId: personalId,
          }),
          newLot(wonRefunded, {
            sellerLegalEntityId: otherPersonalId,
            winnerId: meId,
            buyerLegalEntityId: personalId,
          }),
          // Won personally, but the invoice was addressed to my organisation: still my cost.
          newLot(wonBilledToOrg, {
            sellerLegalEntityId: otherPersonalId,
            winnerId: meId,
            buyerLegalEntityId: personalId,
          }),
          // Won by me, but for my organisation: never part of the personal portfolio.
          newLot(wonForOrg, {
            sellerLegalEntityId: otherPersonalId,
            winnerId: meId,
            buyerLegalEntityId: orgId,
          }),
          // Consigned by me personally.
          newLot(inSale, {
            sellerLegalEntityId: personalId,
            status: "active",
            endTime: new Date(now.getTime() + hour),
            currentPrice: "100.00",
          }),
          newLot(soldPaidOut, {
            sellerLegalEntityId: personalId,
            winnerId: otherId,
            buyerLegalEntityId: otherPersonalId,
          }),
          newLot(sellerDraft, {
            sellerLegalEntityId: personalId,
            status: "draft",
            currentPrice: "100.00",
          }),
          newLot(sellerNoWinner, { sellerLegalEntityId: personalId }),
          // Consigned by my organisation: stays in Bid's organisation views.
          newLot(orgInSale, {
            sellerLegalEntityId: orgId,
            status: "active",
            endTime: new Date(now.getTime() + hour),
          }),
        ]);

        const newPayment = (
          id: string,
          lotId: string,
          buyerId: string,
          buyerLegalEntityId: string,
          sellerLegalEntityId: string,
          status: "captured" | "refunded" | "pending",
        ) => ({
          id,
          lotId,
          buyerId,
          buyerLegalEntityId,
          sellerLegalEntityId,
          amount: "1250.00",
          platformFee: "62.50",
          status,
          createdAt: now,
        });
        await tx
          .insert(payment)
          .values([
            newPayment(paidPayment, wonPaid, meId, personalId, otherPersonalId, "captured"),
            newPayment(refundedPayment, wonRefunded, meId, personalId, otherPersonalId, "refunded"),
            newPayment(soldPayment, soldPaidOut, otherId, otherPersonalId, personalId, "captured"),
            newPayment(
              billedToOrgPayment,
              wonBilledToOrg,
              meId,
              orgId,
              otherPersonalId,
              "captured",
            ),
          ]);
        await tx.insert(paymentExternalRef).values({
          paymentId: paidPayment,
          xeroInvoiceNumber: "INV-0001",
        });
        await tx.insert(lotFulfilment).values({
          lotId: wonPaid,
          paymentId: paidPayment,
          status: "in_transit",
        });

        const newPayout = (id: string, legalEntityId: string, statementUrl: string | null) => ({
          id,
          legalEntityId,
          periodStart: new Date(now.getTime() - 30 * 24 * hour),
          periodEnd: now,
          grossAmount: "1000.00",
          platformFee: "75.00",
          stripeFee: "25.00",
          netAmount: "900.00",
          status: "paid",
          processedAt: now,
          statementUrl,
          createdAt: now,
        });
        await tx.insert(payout).values([
          newPayout(payoutId, personalId, "https://cdn.example/statement.pdf"),
          newPayout(otherPayoutId, otherPersonalId, null),
          {
            ...newPayout(clawbackPayoutId, personalId, null),
            grossAmount: "-350.00",
            platformFee: "0.00",
            stripeFee: "0.00",
            netAmount: "-350.00",
            status: "clawback_pending",
            processedAt: null,
          },
        ]);
        await tx.insert(payoutLine).values({
          payoutId,
          paymentId: soldPayment,
          amount: "1000.00",
          kind: "sale",
        });

        const newSubmission = (
          title: string,
          status: "draft" | "submitted" | "approved" | "converted" | "rejected",
          legalEntityId = personalId,
          convertedLotId: string | null = null,
        ) => ({
          legalEntityId,
          title,
          status,
          images: ["media/submission.jpg"],
          convertedLotId,
          createdAt: now,
          updatedAt: now,
        });
        await tx
          .insert(itemSubmission)
          .values([
            newSubmission("Submitted work", "submitted"),
            newSubmission("Approved work", "approved"),
            newSubmission("Draft work", "draft"),
            newSubmission("Rejected work", "rejected"),
            newSubmission("Converted work", "converted", personalId, inSale),
            newSubmission("Organisation work", "submitted", orgId),
            newSubmission("Someone else's work", "submitted", otherPersonalId),
          ]);

        const facts = await new DrizzleBidPortfolioReader(tx as never).loadForPerson(meId);

        // Wins: only the personal entity's, newest first, with artist, image and fulfilment.
        expect(facts.wonLots.map((l) => l.lotId).sort()).toEqual(
          [wonPaid, wonUnpaid, wonRefunded, wonBilledToOrg].sort(),
        );
        const paid = facts.wonLots.find((l) => l.lotId === wonPaid);
        expect(paid).toMatchObject({
          artistName: "Ada Artist",
          firstImageKey: `media/${wonPaid.slice(0, 4)}.jpg`,
          hammerPrice: "1000.00",
          fulfilmentStatus: "in_transit",
        });
        expect(facts.wonLots.find((l) => l.lotId === wonUnpaid)?.fulfilmentStatus).toBeNull();

        // Payments: the buyer entity's only, with invoice presence.
        expect(facts.payments.map((p) => p.id).sort()).toEqual(
          [paidPayment, refundedPayment, billedToOrgPayment].sort(),
        );
        // A realistic captured payment: settlement amount above the hammer, so the premium can be
        // derived, and found even though it was billed to another entity.
        expect(facts.payments.find((p) => p.id === billedToOrgPayment)).toMatchObject({
          lotId: wonBilledToOrg,
          amount: "1250.00",
          status: "captured",
        });
        expect(facts.wonLots.find((l) => l.lotId === wonBilledToOrg)?.hammerPrice).toBe("1000.00");
        expect(facts.payments.find((p) => p.id === paidPayment)?.hasInvoice).toBe(true);
        expect(facts.payments.find((p) => p.id === refundedPayment)?.hasInvoice).toBe(false);

        // Consignments waiting on review; drafts, rejections, conversions and others excluded.
        expect(facts.submissions.map((s) => s.title).sort()).toEqual([
          "Approved work",
          "Submitted work",
        ]);

        // Selling: the lot in sale and the closed sale with its payout, not drafts, unsold or org lots.
        expect(facts.sellerLots.map((l) => [l.lotId, l.stage]).sort()).toEqual(
          [
            [inSale, "in_sale"],
            [soldPaidOut, "sold"],
          ].sort(),
        );
        expect(facts.sellerLots.find((l) => l.lotId === soldPaidOut)).toMatchObject({
          buyerPaid: true,
          payoutStatus: "paid",
          payoutHasStatement: true,
        });
        expect(facts.sellerLots.find((l) => l.lotId === inSale)).toMatchObject({
          buyerPaid: false,
          payoutStatus: null,
        });

        // Payouts: mine only, including a clawback with a negative net.
        expect(facts.payouts.map((p) => p.id).sort()).toEqual([payoutId, clawbackPayoutId].sort());
        expect(facts.payouts.find((p) => p.id === payoutId)).toMatchObject({
          currency: "GBP",
          netAmount: "900.00",
          platformFee: "75.00",
          stripeFee: "25.00",
          status: "paid",
          hasStatement: true,
        });
        expect(facts.payouts.find((p) => p.id === clawbackPayoutId)).toMatchObject({
          netAmount: "-350.00",
          status: "clawback_pending",
        });

        // A person with no personal entity has nothing, rather than an error.
        const nobody = await new DrizzleBidPortfolioReader(tx as never).loadForPerson(
          `portfolio-missing-${tag}`,
        );
        expect(nobody).toEqual({
          wonLots: [],
          payments: [],
          submissions: [],
          sellerLots: [],
          payouts: [],
        });

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
