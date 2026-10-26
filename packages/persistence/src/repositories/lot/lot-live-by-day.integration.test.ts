import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { legalEntity, lot, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleLotRepository } from "../drizzle-lot.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const DAY_MS = 86_400_000;

/**
 * The staff Lots summary trends "Live" by the lots open for bidding each day. Runs in a
 * transaction that is rolled back, so it leaves no rows behind.
 */
describe.skipIf(!HAS_DB)("lots live by day (integration)", () => {
  it("counts each day a lot's bidding window touches, and skips drafts and cancelled lots", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const at = (daysAgo: number, hour: number) =>
      new Date(midnight - daysAgo * DAY_MS + hour * 3_600_000);
    const key = (daysAgo: number) =>
      new Date(midnight - daysAgo * DAY_MS).toISOString().slice(0, 10);
    const tag = randomUUID().slice(0, 8);
    const ownerId = `live-by-day-${tag}`;
    const sellerEntityId = randomUUID();

    try {
      await db.transaction(async (tx) => {
        const before = await new DrizzleLotRepository(tx).countLiveByDay(
          new Date(midnight - 5 * DAY_MS),
        );
        await tx.insert(user).values({
          id: ownerId,
          name: ownerId,
          email: `${ownerId}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(legalEntity).values({
          id: sellerEntityId,
          displayName: sellerEntityId,
          kind: "organisation" as const,
          subkind: "gallery" as const,
          createdByUserId: ownerId,
          status: "approved" as const,
          createdAt: now,
          updatedAt: now,
        });
        const newLot = (status: "ended" | "draft" | "cancelled", start: Date, end: Date) => ({
          id: randomUUID(),
          sellerLegalEntityId: sellerEntityId,
          title: `Live by day ${tag}`,
          images: [],
          auctionType: "english" as const,
          startingPrice: "100.00",
          currentPrice: "100.00",
          minBidIncrement: "10.00",
          startTime: start,
          endTime: end,
          status,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(lot).values([
          // Open from three days ago to two days ago: counts on both days.
          newLot("ended", at(3, 10), at(2, 18)),
          newLot("draft", at(3, 10), at(2, 18)),
          newLot("cancelled", at(3, 10), at(2, 18)),
        ]);

        const after = await new DrizzleLotRepository(tx).countLiveByDay(
          new Date(midnight - 5 * DAY_MS),
        );
        expect([...after.keys()]).toHaveLength(6);
        const added = (daysAgo: number) =>
          (after.get(key(daysAgo)) ?? 0) - (before.get(key(daysAgo)) ?? 0);
        expect([4, 3, 2, 1, 0].map(added)).toEqual([0, 1, 1, 0, 0]);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
