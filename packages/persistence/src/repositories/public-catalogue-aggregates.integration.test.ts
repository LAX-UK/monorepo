import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { category, legalEntity, lot, lotCategories, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleCategoryRepository } from "./drizzle-category.repository.js";
import { sumEndedLotHammer } from "./lot/lot-analytics-queries.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("public catalogue aggregates (integration)", () => {
  it("lists only categories with published lots, and totals the hammer of sold lots only", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const rollback = new Error("rollback_test_tx");
    const now = new Date();
    const tag = randomUUID().slice(0, 8);
    const sellerUser = `catalogue-agg-${tag}`;
    const sellerEntity = randomUUID();
    const withLots = randomUUID();
    const draftOnly = randomUUID();
    const empty = randomUUID();
    const sold = randomUUID();
    const unsold = randomUUID();
    const draft = randomUUID();
    // A year no other data uses, so the totals read only this test's lots.
    const endTime = new Date(Date.UTC(2091, 5, 1));

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: sellerUser,
          name: "Seller",
          email: `${sellerUser}@integration.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(legalEntity).values({
          id: sellerEntity,
          displayName: "Seller",
          kind: "individual",
          subkind: "private_collector",
          createdByUserId: sellerUser,
          status: "approved",
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(category).values(
          [withLots, draftOnly, empty].map((id, i) => ({
            id,
            name: `Category ${i}`,
            slug: `agg-${i}-${tag}`,
            archived: false,
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          })),
        );
        const newLot = (
          id: string,
          fields: Partial<typeof lot.$inferInsert>,
        ): typeof lot.$inferInsert => ({
          id,
          title: `Lot ${id.slice(0, 4)}`,
          images: [],
          auctionType: "english",
          startingPrice: "100.00",
          currentPrice: "100.00",
          minBidIncrement: "10.00",
          startTime: new Date(endTime.getTime() - 86_400_000),
          endTime,
          status: "ended",
          sellerLegalEntityId: sellerEntity,
          createdAt: now,
          updatedAt: now,
          ...fields,
        });
        await tx
          .insert(lot)
          .values([
            newLot(sold, { currentPrice: "5000.00", winnerId: sellerUser }),
            newLot(unsold, { currentPrice: "3000.00", winnerId: null }),
            newLot(draft, { status: "draft" }),
          ]);
        await tx.insert(lotCategories).values([
          { lotId: sold, categoryId: withLots },
          { lotId: draft, categoryId: draftOnly },
        ]);

        const ids = await new DrizzleCategoryRepository(tx as never).findIdsWithPublishedLots();
        expect(ids.has(withLots)).toBe(true);
        expect(ids.has(draftOnly)).toBe(false);
        expect(ids.has(empty)).toBe(false);

        const totals = await sumEndedLotHammer(tx as never, { endYear: 2091 });
        expect(Number(totals.total)).toBe(5000);
        expect(totals.count).toBe(2);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
