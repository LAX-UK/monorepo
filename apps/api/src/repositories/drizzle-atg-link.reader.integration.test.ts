import { type Database, createDb } from "@auction/db";
import { atgAuctionLink, atgLotLink, legalEntity, lot, sale, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleAtgLinkReader } from "./drizzle-atg-link.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleAtgLinkReader (integration)", () => {
  const saleId = "a7b00000-0000-4000-8000-000000000001";
  const sellerUserId = "atg-reader-seller";
  const sellerLeId = "a7b00000-0000-4000-8000-000000000002";
  const linkedLotId = "a7b00000-0000-4000-8000-000000000011";
  const unlinkedLotId = "a7b00000-0000-4000-8000-000000000012";
  const cancelledLotId = "a7b00000-0000-4000-8000-000000000013";

  it("returns sale link state with every live lot, linked or not", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_atg_reader_test");
    const t = new Date("2026-10-01T00:00:00Z");

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: sellerUserId,
          name: "Seller",
          email: "atg-reader-seller@integration.test",
          emailVerified: true,
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(legalEntity).values({
          id: sellerLeId,
          displayName: "Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: sellerUserId,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(sale).values({
          id: saleId,
          title: "ATG sale",
          startTime: new Date("2026-10-20T10:00:00Z"),
          endTime: new Date("2026-11-01T18:00:00Z"),
          createdByLegalEntityId: sellerLeId,
        });
        const base = {
          saleId,
          sellerLegalEntityId: sellerLeId,
          auctionType: "english" as const,
          startingPrice: "100",
          currentPrice: "100",
          startTime: new Date("2026-10-20T10:00:00Z"),
          endTime: new Date("2026-11-01T18:00:00Z"),
        };
        await tx.insert(lot).values([
          { ...base, id: linkedLotId, lotNumber: 1, title: "Linked" },
          { ...base, id: unlinkedLotId, lotNumber: 2, title: "Unlinked" },
          {
            ...base,
            id: cancelledLotId,
            lotNumber: 3,
            title: "Cancelled",
            status: "cancelled" as const,
          },
        ]);

        const reader = new DrizzleAtgLinkReader(tx as unknown as Database);
        expect(await reader.getSaleView(saleId)).toMatchObject({
          saleCancelled: false,
          linked: false,
          results: [],
        });

        await tx.insert(atgAuctionLink).values({
          saleId,
          atgAuctionId: "atg-a",
          remoteStatus: "published",
          publishedAt: t,
          resultsSnapshot: [{ lotNumber: "1", hammerPrice: 1500 }],
        });
        await tx.insert(atgLotLink).values({
          lotId: linkedLotId,
          saleId,
          atgLotId: "atg-l1",
          imageNames: ["1", "1-1"],
          sold: true,
          hammerPrice: "1500.00",
        });

        const view = await reader.getSaleView(saleId);
        expect(view).toMatchObject({
          linked: true,
          atgAuctionId: "atg-a",
          remoteStatus: "published",
          publishedAt: t.toISOString(),
          results: [{ lotNumber: "1", hammerPrice: 1500 }],
        });
        expect(view?.lots).toEqual([
          expect.objectContaining({
            lotId: linkedLotId,
            atgLotId: "atg-l1",
            imageCount: 2,
            sold: true,
            hammerPrice: "1500.00",
          }),
          expect.objectContaining({ lotId: unlinkedLotId, atgLotId: null, imageCount: 0 }),
        ]);
        await tx.update(sale).set({ status: "cancelled" }).where(eq(sale.id, saleId));
        expect((await reader.getSaleView(saleId))?.saleCancelled).toBe(true);
        expect(await reader.findAtgLotId(linkedLotId)).toBe("atg-l1");
        expect(await reader.findAtgLotId(unlinkedLotId)).toBeNull();
        expect(await reader.getSaleView("a7b00000-0000-4000-8000-0000000000ff")).toBeNull();
        throw rollback;
      });
    } catch (err) {
      if (err !== rollback) throw err;
    }
  });
});
