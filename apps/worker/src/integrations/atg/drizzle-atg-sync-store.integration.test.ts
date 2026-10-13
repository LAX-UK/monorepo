import { type Database, createDb } from "@auction/db";
import { atgLotLink, legalEntity, lot, sale, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleAtgSyncStore } from "./drizzle-atg-sync-store.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const saleId = "a7a00000-0000-4000-8000-000000000001";
const sellerUserId = "atg-store-seller";
const sellerLeId = "a7a00000-0000-4000-8000-000000000002";
const lotIds = [
  "a7a00000-0000-4000-8000-000000000011",
  "a7a00000-0000-4000-8000-000000000012",
  "a7a00000-0000-4000-8000-000000000013",
] as const;

async function withSeededSale(run: (store: DrizzleAtgSyncStore, db: Database) => Promise<void>) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDb(databaseUrl);
  const rollback = new Error("rollback_atg_store_test");
  const t = new Date("2026-10-01T00:00:00Z");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: sellerUserId,
        name: "Seller",
        email: "atg-store-seller@integration.test",
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
        createdAt: t,
        updatedAt: t,
      });
      const base = {
        saleId,
        sellerLegalEntityId: sellerLeId,
        auctionType: "english" as const,
        startingPrice: "100",
        currentPrice: "100",
        startTime: new Date("2026-10-20T10:00:00Z"),
        endTime: new Date("2026-11-01T18:00:00Z"),
        createdAt: t,
        updatedAt: t,
      };
      await tx.insert(lot).values([
        { ...base, id: lotIds[0], lotNumber: 2, title: "Second" },
        { ...base, id: lotIds[1], lotNumber: 1, title: "First" },
        { ...base, id: lotIds[2], lotNumber: 3, title: "Deleted", deletedAt: t },
      ]);
      const txDb = tx as unknown as Database;
      await run(new DrizzleAtgSyncStore(txDb), txDb);
      throw rollback;
    });
  } catch (err) {
    if (err !== rollback) throw err;
  }
}

describe.skipIf(!HAS_DB)("DrizzleAtgSyncStore (integration)", () => {
  it("loads non-deleted lots in lot-number order", async () => {
    await withSeededSale(async (store) => {
      const snapshot = await store.loadSale(saleId);
      expect(snapshot?.lots.map((l) => l.title)).toEqual(["First", "Second"]);
      expect(snapshot?.buyerPremiumRate).toBe("0.2500");
    });
  });

  it("upserts auction links and round-trips lot links and remote state", async () => {
    await withSeededSale(async (store, db) => {
      await store.saveAuctionLink(saleId, { lastError: "boom" });
      await store.saveAuctionLink(saleId, {
        atgAuctionId: "atg-a",
        remoteStatus: "published",
        lastError: null,
      });
      expect(await store.getAuctionLink(saleId)).toMatchObject({
        atgAuctionId: "atg-a",
        remoteStatus: "published",
      });

      await store.insertLotLink({
        lotId: lotIds[0],
        saleId,
        atgLotId: "atg-l1",
        payloadHash: "h1",
      });
      await store.updateLotLink(lotIds[0], { imageNames: ["1", "1-1"] });
      await store.applyRemoteLots(
        saleId,
        [
          {
            atgLotId: "atg-l1",
            lotNumber: "2",
            status: 2,
            sold: true,
            hammerPrice: 1500,
            currentMaxBid: 1500.5,
            numberOfBids: 7,
            winningBidderId: "bidder-1",
            endTimeUtc: null,
          },
        ],
        new Date("2026-11-01T18:05:00Z"),
      );

      expect(await store.getLotLink(lotIds[0])).toEqual({
        lotId: lotIds[0],
        saleId,
        atgLotId: "atg-l1",
        imageNames: ["1", "1-1"],
        payloadHash: "h1",
      });
      const [row] = await db.select().from(atgLotLink).where(eq(atgLotLink.lotId, lotIds[0]));
      expect(row).toMatchObject({
        sold: true,
        hammerPrice: "1500.00",
        currentMaxBid: "1500.50",
        status: "2",
      });

      await store.deleteLotLink(lotIds[0]);
      expect(await store.listLotLinks(saleId)).toEqual([]);
    });
  });

  it("lists live and recently closed links only", async () => {
    await withSeededSale(async (store) => {
      await store.saveAuctionLink(saleId, {
        atgAuctionId: "atg-a",
        remoteStatus: "closed",
        closedAt: new Date("2026-10-01T00:00:00Z"),
      });
      expect(await store.listActiveAuctionLinks(new Date("2026-09-30T00:00:00Z"))).toHaveLength(1);
      expect(await store.listActiveAuctionLinks(new Date("2026-10-02T00:00:00Z"))).toHaveLength(0);
    });
  });

  it("detects sale edits, lot edits and soft-deleted linked lots after a sync", async () => {
    await withSeededSale(async (store, db) => {
      const syncedAt = new Date("2026-10-05T00:00:00Z");
      await store.saveAuctionLink(saleId, { atgAuctionId: "atg-a", remoteStatus: "created" });
      expect(await store.hasCatalogueChangesSince(saleId, syncedAt)).toBe(false);

      await db
        .update(lot)
        .set({ updatedAt: new Date("2026-10-06T00:00:00Z") })
        .where(eq(lot.id, lotIds[0]));
      expect(await store.hasCatalogueChangesSince(saleId, syncedAt)).toBe(true);

      const later = new Date("2026-10-07T00:00:00Z");
      await store.insertLotLink({ lotId: lotIds[1], saleId, atgLotId: "atg-l2", payloadHash: "h" });
      await db
        .update(lot)
        .set({ saleId: null, deletedAt: new Date("2026-10-08T00:00:00Z") })
        .where(eq(lot.id, lotIds[1]));
      expect(await store.hasCatalogueChangesSince(saleId, later)).toBe(true);
    });
  });
});
