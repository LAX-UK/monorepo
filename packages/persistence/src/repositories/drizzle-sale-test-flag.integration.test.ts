import { type Database, createDb } from "@auction/db";
import { legalEntity, lot, sale, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { BidAlertMatchValidator } from "./bid-alerts/index.js";
import { DrizzleLotRepository } from "./drizzle-lot.repository.js";
import { DrizzleSaleCoverRepository } from "./drizzle-sale-cover.repository.js";
import { DrizzleSaleRepository } from "./drizzle-sale.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const ids = {
  user: "test-flag-seller",
  le: "b9d00000-0000-4000-8000-000000000001",
  publicSale: "b9d00000-0000-4000-8000-000000000010",
  testSale: "b9d00000-0000-4000-8000-000000000020",
  publicLot: "b9d00000-0000-4000-8000-000000000011",
  testLot: "b9d00000-0000-4000-8000-000000000021",
  testWithdrawn: "b9d00000-0000-4000-8000-000000000022",
} as const;

describe.skipIf(!HAS_DB)("test sales are hidden from public reads (integration)", () => {
  it("leaves a test sale and its lots out of every public read, and keeps staff reads whole", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_test_flag");
    const t = new Date("2026-10-01T00:00:00Z");
    const start = new Date("2026-10-20T10:00:00Z");
    const end = new Date("2026-10-31T18:00:00Z");

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: ids.user,
          name: "Seller",
          email: "test-flag-seller@integration.test",
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
        const saleRow = (id: string, isTest: boolean) => ({
          id,
          title: isTest ? "Rehearsal sale" : "Public sale",
          status: "active" as const,
          isTest,
          startTime: start,
          endTime: end,
          createdByLegalEntityId: ids.le,
        });
        await tx.insert(sale).values([saleRow(ids.publicSale, false), saleRow(ids.testSale, true)]);
        const lotRow = (id: string, saleId: string, n: number, status: "active" | "cancelled") => ({
          id,
          saleId,
          lotNumber: n,
          title: `Lot ${n}`,
          sellerLegalEntityId: ids.le,
          auctionType: "english" as const,
          startingPrice: "100",
          currentPrice: "100",
          status,
          startTime: start,
          endTime: end,
        });
        await tx
          .insert(lot)
          .values([
            lotRow(ids.publicLot, ids.publicSale, 1, "active"),
            lotRow(ids.testLot, ids.testSale, 1, "active"),
            lotRow(ids.testWithdrawn, ids.testSale, 2, "cancelled"),
          ]);

        const conn = tx as unknown as Database;
        const sales = new DrizzleSaleRepository(conn);
        const lots = new DrizzleLotRepository(conn);

        // Sale lists: public reads exclude, staff reads keep both and expose the flag.
        const base = { statuses: ["active" as const], limit: 50, offset: 0 };
        const publicList = await sales.list({ ...base, excludeTestSales: true });
        expect(publicList.map((s) => s.id)).toContain(ids.publicSale);
        expect(publicList.map((s) => s.id)).not.toContain(ids.testSale);
        const staffList = await sales.list(base);
        const staffIds = staffList.map((s) => s.id);
        expect(staffIds).toEqual(expect.arrayContaining([ids.publicSale, ids.testSale]));
        expect(staffList.find((s) => s.id === ids.testSale)?.isTest).toBe(true);
        expect(staffList.find((s) => s.id === ids.publicSale)?.isTest).toBe(false);

        // Sale catalogue page, lot counts, previews and lot browse.
        const catalogue = (saleId: string, requirePublicSale: boolean) =>
          lots.listCatalogLotsBySalePage({
            saleId,
            sort: "lot",
            limit: 50,
            offset: 0,
            ...(requirePublicSale ? { requirePublicSale: true } : {}),
          });
        expect((await catalogue(ids.publicSale, true)).items.map((l) => l.id)).toEqual([
          ids.publicLot,
        ]);
        expect((await catalogue(ids.testSale, true)).items).toEqual([]);
        expect((await catalogue(ids.testSale, false)).items.map((l) => l.id)).toEqual([
          ids.testLot,
          ids.testWithdrawn,
        ]);

        const counts = await lots.countLotsBySaleIds([ids.publicSale, ids.testSale], {
          publicOnly: true,
        });
        expect(counts.get(ids.publicSale)).toBe(1);
        expect(counts.get(ids.testSale)).toBeUndefined();
        const previews = await lots.findPreviewLotsBySaleIds([ids.publicSale, ids.testSale], 10, {
          publicOnly: true,
        });
        expect(previews.map((l) => l.id)).toEqual([ids.publicLot]);

        const browse = (requirePublicParentSale: boolean) =>
          lots.list({
            statuses: ["active"],
            ...(requirePublicParentSale ? { requirePublicParentSale: true } : {}),
            limit: 50,
            offset: 0,
          });
        const publicBrowse = (await browse(true)).map((l) => l.id);
        expect(publicBrowse).toContain(ids.publicLot);
        expect(publicBrowse).not.toContain(ids.testLot);
        expect((await browse(false)).map((l) => l.id)).toContain(ids.testLot);

        // A test sale cannot lead the home page.
        const statuses = await new DrizzleSaleCoverRepository(conn).getSaleStatuses([
          ids.publicSale,
          ids.testSale,
        ]);
        expect([...statuses.keys()]).toEqual([ids.publicSale]);

        // A match for a sale that became a test sale is dropped at digest time.
        const stale = await new BidAlertMatchValidator(conn).staleMatches([
          matchFor(ids.publicSale, "m-public"),
          matchFor(ids.testSale, "m-test"),
        ]);
        expect([...stale.keys()]).toEqual(["m-test"]);
        throw rollback;
      });
    } catch (err) {
      if (err !== rollback) throw err;
    }
  });
});

function matchFor(saleId: string, id: string) {
  return {
    id,
    subscriberId: "subscriber",
    topic: "bid.new_sales" as const,
    itemKey: `sale:${saleId}`,
    groupKey: null,
    snapshot: { title: "x", path: "/sales/x" },
    matchedAt: new Date("2026-11-03T09:00:00Z"),
  };
}
