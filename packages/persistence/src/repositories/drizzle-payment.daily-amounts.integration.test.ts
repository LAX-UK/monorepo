import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { bidUserProfile, legalEntity, lot, payment, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzlePaymentRepository } from "./drizzle-payment.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const DAY_MS = 86_400_000;

/**
 * The staff Payments summary draws a daily trend for each total. Runs in a transaction that is
 * rolled back, so it leaves no rows behind.
 */
describe.skipIf(!HAS_DB)("admin payments daily amounts (integration)", () => {
  it("sums each UTC day by where the payments are now, under the table's filters", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 1));
    const yesterday = new Date(today.getTime() - DAY_MS);
    const longAgo = new Date(today.getTime() - 90 * DAY_MS);
    const key = (d: Date) => d.toISOString().slice(0, 10);
    const tag = randomUUID().slice(0, 8);
    const buyerId = `daily-amounts-buyer-${tag}`;
    const sellerEntityId = randomUUID();
    const buyerEntityId = randomUUID();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: buyerId,
          name: buyerId,
          email: `${buyerId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(bidUserProfile).values({ userId: buyerId, createdAt: now, updatedAt: now });
        await tx.insert(legalEntity).values(
          [sellerEntityId, buyerEntityId].map((id) => ({
            id,
            displayName: id,
            kind: "organisation" as const,
            subkind: "gallery" as const,
            createdByUserId: buyerId,
            status: "approved" as const,
            createdAt: now,
            updatedAt: now,
          })),
        );
        const payments = [
          { amount: "100.00", status: "captured" as const, createdAt: today },
          { amount: "40.50", status: "refunded" as const, createdAt: today },
          { amount: "20.00", status: "authorized" as const, createdAt: yesterday },
          { amount: "5.00", status: "pending" as const, createdAt: yesterday },
          { amount: "999.00", status: "captured" as const, createdAt: longAgo },
        ];
        const lotIds = payments.map(() => randomUUID());
        await tx.insert(lot).values(
          lotIds.map((id) => ({
            id,
            sellerLegalEntityId: sellerEntityId,
            title: `Daily amounts lot ${tag}`,
            images: [],
            auctionType: "english" as const,
            startingPrice: "100.00",
            currentPrice: "250.00",
            minBidIncrement: "10.00",
            startTime: new Date(now.getTime() - DAY_MS),
            endTime: new Date(now.getTime() - 3_600_000),
            status: "ended" as const,
            winnerId: buyerId,
            buyerLegalEntityId: buyerEntityId,
            createdAt: now,
            updatedAt: now,
          })),
        );
        await tx.insert(payment).values(
          payments.map((p, index) => ({
            lotId: lotIds[index] as string,
            buyerId,
            buyerLegalEntityId: buyerEntityId,
            sellerLegalEntityId: sellerEntityId,
            amount: p.amount,
            platformFee: "0.00",
            status: p.status,
            createdAt: p.createdAt,
          })),
        );

        const repo = new DrizzlePaymentRepository(tx);
        const byDay = await repo.sumAdminTableAmountsByDay(
          { q: `Daily amounts lot ${tag}` },
          new Date(today.getTime() - 60 * DAY_MS),
        );
        expect(byDay.get(key(today))).toEqual({
          volume: 14050,
          captured: 10000,
          refunded: 4050,
          awaiting: 0,
        });
        expect(byDay.get(key(yesterday))).toEqual({
          volume: 2500,
          captured: 0,
          refunded: 0,
          awaiting: 2500,
        });
        // Before the range, and outside the filter, nothing is counted.
        expect(byDay.has(key(longAgo))).toBe(false);
        const captured = await repo.sumAdminTableAmountsByDay(
          { q: `Daily amounts lot ${tag}`, status: "captured" },
          new Date(today.getTime() - 60 * DAY_MS),
        );
        expect([...captured.keys()]).toEqual([key(today)]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
