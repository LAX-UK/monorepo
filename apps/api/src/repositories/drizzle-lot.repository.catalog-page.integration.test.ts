import { createDb } from "@auction/db";
import { legalEntity, lot, sale } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleLotRepository } from "./drizzle-lot.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleLotRepository.listCatalogLotsBySalePage (integration)", () => {
  const saleId = "44444444-4444-4444-8444-444444444444";
  const sellerLeId = "55555555-5555-4555-8555-555555555555";

  it("returns only public lots with accurate total for anonymous catalog page", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_catalog_page_test");

    try {
      await db.transaction(async (tx) => {
        const t = new Date();
        await tx.insert(legalEntity).values({
          id: sellerLeId,
          displayName: "Gallery",
          kind: "organisation",
          subkind: "gallery",
          createdByUserId: "catalog-page-seller",
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        await tx.insert(sale).values({
          id: saleId,
          title: "Public sale",
          status: "active",
          deliveryMode: "online",
          startTime: new Date("2026-07-01T12:00:00.000Z"),
          endTime: new Date("2026-07-02T12:00:00.000Z"),
          buyerPremiumRate: "0.25",
          createdBy: "catalog-page-seller",
          createdByLegalEntityId: sellerLeId,
          createdAt: t,
          updatedAt: t,
        });

        const lotBase = {
          saleId,
          sellerLegalEntityId: sellerLeId,
          title: "Lot",
          categoryId: "c1000001-0000-4000-8000-000000000001",
          auctionType: "english" as const,
          startingPrice: "100",
          currentPrice: "100",
          buyerPremiumRate: "0.25",
          minBidIncrement: "10",
          startTime: new Date("2026-07-01T12:00:00.000Z"),
          endTime: new Date("2026-07-02T12:00:00.000Z"),
          createdAt: t,
          updatedAt: t,
        };

        await tx.insert(lot).values([
          {
            ...lotBase,
            id: "66666666-6666-4666-8666-666666666661",
            lotNumber: 1,
            status: "scheduled",
          },
          { ...lotBase, id: "66666666-6666-4666-8666-666666666662", lotNumber: 2, status: "draft" },
          {
            ...lotBase,
            id: "66666666-6666-4666-8666-666666666663",
            lotNumber: 3,
            status: "active",
          },
        ]);

        const repo = new DrizzleLotRepository(tx);
        const page = await repo.listCatalogLotsBySalePage({
          saleId,
          lotStatuses: ["scheduled", "active", "ended"],
          requirePublicSale: true,
          sort: "lot",
          limit: 10,
          offset: 0,
        });

        expect(page.total).toBe(2);
        expect(page.items.map((row) => row.status).sort()).toEqual(["active", "scheduled"]);

        throw rollback;
      });
    } catch (e) {
      if (e !== rollback) throw e;
    }
  });
});
