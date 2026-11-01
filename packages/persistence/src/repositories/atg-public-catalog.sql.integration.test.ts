import { type Database, createDb } from "@auction/db";
import { atgAuctionLink, atgLotLink, legalEntity, lot, sale, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleAtgLinkReader } from "./drizzle-atg-link.reader.js";
import { DrizzleLotRepository } from "./drizzle-lot.repository.js";
import { DrizzleSaleRepository } from "./drizzle-sale.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const ids = {
  user: "atg-public-seller",
  le: "a7c00000-0000-4000-8000-000000000001",
  liveSale: "a7c00000-0000-4000-8000-000000000010",
  soldSale: "a7c00000-0000-4000-8000-000000000020",
  unsoldSale: "a7c00000-0000-4000-8000-000000000030",
  plainDraft: "a7c00000-0000-4000-8000-000000000040",
  liveLot: "a7c00000-0000-4000-8000-000000000011",
  soldLot: "a7c00000-0000-4000-8000-000000000021",
  unsoldLot: "a7c00000-0000-4000-8000-000000000031",
  plainLot: "a7c00000-0000-4000-8000-000000000041",
  privateSale: "a7c00000-0000-4000-8000-000000000050",
  privateLot: "a7c00000-0000-4000-8000-000000000051",
} as const;

const ourSales = new Set<string>([
  ids.liveSale,
  ids.soldSale,
  ids.unsoldSale,
  ids.plainDraft,
  ids.privateSale,
]);
const ourLots = new Set<string>([
  ids.liveLot,
  ids.soldLot,
  ids.unsoldLot,
  ids.plainLot,
  ids.privateLot,
]);

describe.skipIf(!HAS_DB)("ATG-owned drafts in public catalogue SQL (integration)", () => {
  it("matches ownership in batch lookups, sale lists and lot search", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_atg_public_test");
    const t = new Date("2026-10-01T00:00:00Z");
    const start = new Date("2026-10-20T10:00:00Z");
    const end = new Date("2026-11-01T18:00:00Z");

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: ids.user,
          name: "Seller",
          email: "atg-public-seller@integration.test",
          emailVerified: true,
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(legalEntity).values({
          id: ids.le,
          displayName: "Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: ids.user,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        const saleRow = (id: string, title: string) => ({
          id,
          title,
          startTime: start,
          endTime: end,
          createdByLegalEntityId: ids.le,
        });
        await tx
          .insert(sale)
          .values([
            saleRow(ids.liveSale, "Live on ATG"),
            saleRow(ids.soldSale, "Sold on ATG"),
            saleRow(ids.unsoldSale, "Closed unsold"),
            saleRow(ids.plainDraft, "Plain draft"),
            saleRow(ids.privateSale, "Private test on ATG"),
          ]);
        const lotRow = (id: string, saleId: string) => ({
          id,
          saleId,
          lotNumber: 1,
          title: `Lot ${id.slice(-2)}`,
          sellerLegalEntityId: ids.le,
          auctionType: "english" as const,
          startingPrice: "100",
          currentPrice: "100",
          startTime: start,
          endTime: end,
        });
        await tx
          .insert(lot)
          .values([
            lotRow(ids.liveLot, ids.liveSale),
            lotRow(ids.soldLot, ids.soldSale),
            lotRow(ids.unsoldLot, ids.unsoldSale),
            lotRow(ids.plainLot, ids.plainDraft),
            lotRow(ids.privateLot, ids.privateSale),
          ]);
        await tx.insert(atgAuctionLink).values([
          {
            saleId: ids.liveSale,
            atgAuctionId: "atg-live",
            remoteStatus: "published",
            distribution: "public_marketplace",
          },
          {
            saleId: ids.soldSale,
            atgAuctionId: "atg-sold",
            remoteStatus: "closed",
            distribution: "public_marketplace",
          },
          {
            saleId: ids.unsoldSale,
            atgAuctionId: "atg-unsold",
            remoteStatus: "closed",
            distribution: "public_marketplace",
          },
          {
            saleId: ids.privateSale,
            atgAuctionId: "atg-private",
            remoteStatus: "published",
            distribution: "private_test",
          },
        ]);
        await tx.insert(atgLotLink).values([
          { lotId: ids.liveLot, saleId: ids.liveSale, atgLotId: "l-live", numberOfBids: 2 },
          { lotId: ids.soldLot, saleId: ids.soldSale, atgLotId: "l-sold", sold: true },
          { lotId: ids.unsoldLot, saleId: ids.unsoldSale, atgLotId: "l-unsold", sold: false },
        ]);

        const conn = tx as unknown as Database;
        const ownership = await new DrizzleAtgLinkReader(conn).getSaleOwnerships([
          ids.liveSale,
          ids.soldSale,
          ids.unsoldSale,
          ids.plainDraft,
          ids.privateSale,
        ]);
        expect(
          Object.fromEntries([...ownership].map(([id, o]) => [id, o.sellingPlatform])),
        ).toEqual({
          [ids.liveSale]: "atg",
          [ids.soldSale]: "atg",
          [ids.unsoldSale]: "free",
          [ids.plainDraft]: "free",
          [ids.privateSale]: "atg",
        });
        expect(ownership.get(ids.privateSale)?.atgDistribution).toBe("private_test");
        expect(ownership.get(ids.soldSale)?.atgSoldLotCount).toBe(1);

        const sales = new DrizzleSaleRepository(conn);
        const listed = async (statuses: ("scheduled" | "active" | "ended")[]) =>
          (await sales.list({ statuses, includeAtgOwnedDrafts: true, limit: 500, offset: 0 }))
            .map((s) => s.id)
            .filter((id) => ourSales.has(id));
        expect(await listed(["scheduled", "active"])).toEqual([ids.liveSale]);
        expect(await listed(["ended"])).toEqual([ids.soldSale]);
        expect((await listed(["scheduled", "active", "ended"])).sort()).toEqual(
          [ids.liveSale, ids.soldSale].sort(),
        );
        const withoutFlag = await sales.list({ statuses: ["active"], limit: 500, offset: 0 });
        expect(withoutFlag.some((s) => ourSales.has(s.id))).toBe(false);

        const lots = new DrizzleLotRepository(conn);
        const searched = async (statuses: ("scheduled" | "active" | "ended")[]) =>
          (await lots.list({ statuses, requirePublicParentSale: true, limit: 500, offset: 0 }))
            .map((l) => l.id)
            .filter((id) => ourLots.has(id));
        expect(await searched(["scheduled", "active"])).toEqual([ids.liveLot]);
        expect(await searched(["ended"])).toEqual([ids.soldLot]);
        throw rollback;
      });
    } catch (err) {
      if (err !== rollback) throw err;
    }
  });
});
