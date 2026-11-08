import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidUserProfile, legalEntity, lot, payment, paymentGroup, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzlePaymentGroupFactsReader } from "./drizzle-payment-group-facts.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

/**
 * Only a combined payment that is under way (`processing`) is reported, for the payments inside
 * it; an invoice paid on its own, or in a group that is open or settled, has no group. Runs in a
 * transaction that is rolled back.
 */
describe.skipIf(!HAS_DB)("payment group facts reader (integration)", () => {
  it("reports the processing group of each payment, and nothing else", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const userId = `group-facts-${tag}`;
    const entityId = randomUUID();
    const processingGroup = randomUUID();
    const openGroup = randomUUID();
    const lots = { inProcessing: randomUUID(), inOpen: randomUUID(), alone: randomUUID() };
    const payments = { inProcessing: randomUUID(), inOpen: randomUUID(), alone: randomUUID() };

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: userId,
          name: userId,
          email: `${userId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(bidUserProfile).values({ userId, createdAt: now, updatedAt: now });
        await tx.insert(legalEntity).values({
          id: entityId,
          displayName: entityId,
          kind: "individual",
          subkind: "private_collector",
          createdByUserId: userId,
          status: "approved",
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(lot).values(
          Object.values(lots).map((id) => ({
            id,
            title: `Lot ${id.slice(0, 4)}`,
            images: [],
            auctionType: "english" as const,
            startingPrice: "100.00",
            currentPrice: "1000.00",
            minBidIncrement: "10.00",
            startTime: new Date(now.getTime() - 48 * 3_600_000),
            endTime: new Date(now.getTime() - 3_600_000),
            status: "ended" as const,
            sellerLegalEntityId: entityId,
            winnerId: userId,
            buyerLegalEntityId: entityId,
            createdAt: now,
            updatedAt: now,
          })),
        );
        await tx.insert(paymentGroup).values([
          {
            id: processingGroup,
            buyerLegalEntityId: entityId,
            status: "processing",
            totalAmount: "2000.00",
            checkoutRail: "gb_bank_transfer",
            amountReceived: "500.00",
          },
          {
            id: openGroup,
            buyerLegalEntityId: entityId,
            status: "open",
            totalAmount: "1000.00",
            checkoutRail: "card",
          },
        ]);
        const newPayment = (id: string, lotId: string, paymentGroupId: string | null) => ({
          id,
          lotId,
          buyerId: userId,
          buyerLegalEntityId: entityId,
          sellerLegalEntityId: entityId,
          amount: "1000.00",
          platformFee: "50.00",
          status: "authorized" as const,
          paymentGroupId,
          createdAt: now,
        });
        await tx
          .insert(payment)
          .values([
            newPayment(payments.inProcessing, lots.inProcessing, processingGroup),
            newPayment(payments.inOpen, lots.inOpen, openGroup),
            newPayment(payments.alone, lots.alone, null),
          ]);

        const found = await new DrizzlePaymentGroupFactsReader(tx as never).processingForPayments(
          Object.values(payments),
        );
        expect([...found.keys()]).toEqual([payments.inProcessing]);
        expect(found.get(payments.inProcessing)).toEqual({
          id: processingGroup,
          status: "processing",
          checkoutRail: "gb_bank_transfer",
          totalAmount: "2000.00",
          amountReceived: "500.00",
        });
        expect(
          await new DrizzlePaymentGroupFactsReader(tx as never).processingForPayments([]),
        ).toEqual(new Map());
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
