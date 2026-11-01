import { type Database, createDb } from "@auction/db";
import { legalEntity, lot, sale, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleLotRepository } from "./drizzle-lot.repository.js";
import { DrizzleSaleResultLotsReader } from "./drizzle-sale-result-lots.reader.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const ids = {
  user: "withdrawn-seller",
  le: "b8d00000-0000-4000-8000-000000000001",
  sale: "b8d00000-0000-4000-8000-000000000010",
  sold: "b8d00000-0000-4000-8000-000000000011",
  unsold: "b8d00000-0000-4000-8000-000000000012",
  withdrawn: "b8d00000-0000-4000-8000-000000000013",
  voided: "b8d00000-0000-4000-8000-000000000014",
  draftSale: "b8d00000-0000-4000-8000-000000000020",
  draftSaleWithdrawn: "b8d00000-0000-4000-8000-000000000021",
} as const;

describe.skipIf(!HAS_DB)("sale results and withdrawn lots (integration)", () => {
  it("reads result rows, and shows withdrawn lots only in a public sale's catalogue", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_withdrawn_test");
    const t = new Date("2026-10-01T00:00:00Z");
    const start = new Date("2026-10-20T10:00:00Z");
    const end = new Date("2026-10-31T18:00:00Z");

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: ids.user,
          name: "Seller",
          email: "withdrawn-seller@integration.test",
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
        const saleRow = (id: string, status: "ended" | "draft") => ({
          id,
          title: `Sale ${id.slice(-2)}`,
          status,
          startTime: start,
          endTime: end,
          createdByLegalEntityId: ids.le,
        });
        await tx.insert(sale).values([saleRow(ids.sale, "ended"), saleRow(ids.draftSale, "draft")]);
        const lotRow = (
          id: string,
          saleId: string,
          n: number,
          status: "ended" | "cancelled" | "voided",
          winnerId?: string,
        ) => ({
          id,
          saleId,
          lotNumber: n,
          title: `Lot ${n}`,
          sellerLegalEntityId: ids.le,
          auctionType: "english" as const,
          startingPrice: "100",
          // A withdrawn lot keeps a high price so only the pinning keeps it last on price sorts.
          currentPrice: status === "cancelled" ? "999" : "250",
          status,
          ...(winnerId ? { winnerId } : {}),
          startTime: start,
          endTime: end,
        });
        await tx
          .insert(lot)
          .values([
            lotRow(ids.sold, ids.sale, 1, "ended", ids.user),
            lotRow(ids.unsold, ids.sale, 2, "ended"),
            lotRow(ids.withdrawn, ids.sale, 3, "cancelled"),
            lotRow(ids.voided, ids.sale, 4, "voided"),
            lotRow(ids.draftSaleWithdrawn, ids.draftSale, 1, "cancelled"),
          ]);

        const conn = tx as unknown as Database;

        const rows = await new DrizzleSaleResultLotsReader(conn).listBySaleIds([ids.sale]);
        const bySale = rows.get(ids.sale) ?? [];
        expect(bySale.map((r) => [r.id, r.status, r.hasWinner]).sort()).toEqual(
          [
            [ids.sold, "ended", true],
            [ids.unsold, "ended", false],
            [ids.withdrawn, "cancelled", false],
            [ids.voided, "voided", false],
          ].sort(),
        );
        expect(await new DrizzleSaleResultLotsReader(conn).listBySaleIds([])).toEqual(new Map());

        const lots = new DrizzleLotRepository(conn);
        const catalogue = await lots.listCatalogLotsBySalePage({
          saleId: ids.sale,
          sort: "lot",
          limit: 50,
          offset: 0,
          requirePublicSale: true,
        });
        expect(catalogue.items.map((l) => l.id)).toEqual([ids.sold, ids.unsold, ids.withdrawn]);
        expect(catalogue.total).toBe(3);

        for (const sort of ["priceDesc", "priceAsc", "endingAsc"] as const) {
          const sorted = await lots.listCatalogLotsBySalePage({
            saleId: ids.sale,
            sort,
            limit: 50,
            offset: 0,
            requirePublicSale: true,
          });
          expect(sorted.items.map((l) => l.id)).toEqual([ids.sold, ids.unsold, ids.withdrawn]);
        }

        const hiddenSale = await lots.listCatalogLotsBySalePage({
          saleId: ids.draftSale,
          sort: "lot",
          limit: 50,
          offset: 0,
          requirePublicSale: true,
        });
        expect(hiddenSale.items).toEqual([]);

        const counts = await lots.countLotsBySaleIds([ids.sale], { publicOnly: true });
        expect(counts.get(ids.sale)).toBe(2);
        const previews = await lots.findPreviewLotsBySaleIds([ids.sale], 10, { publicOnly: true });
        expect(previews.map((l) => l.id).sort()).toEqual([ids.sold, ids.unsold].sort());

        const browse = await lots.list({
          statuses: ["scheduled", "active", "ended"],
          requirePublicParentSale: true,
          saleId: ids.sale,
          limit: 50,
          offset: 0,
        });
        expect(browse.map((l) => l.id).sort()).toEqual([ids.sold, ids.unsold].sort());
        throw rollback;
      });
    } catch (err) {
      if (err !== rollback) throw err;
    }
  });
});
