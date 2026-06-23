import { createDb } from "@auction/db";
import { artistProfile, legalEntity, lot, user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import { DrizzleArtistProfileRepository } from "./drizzle-artist-profile.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)(
  "DrizzleArtistProfileRepository.listPublicDirectory lotCount (integration)",
  () => {
    it("returns a correlated public lot count for seeded artists with attributed lots", async () => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error("DATABASE_URL required");
      const db = createDb(databaseUrl);
      const repo = new DrizzleArtistProfileRepository(db);

      const result = await repo.listPublicDirectory({
        limit: 5,
        offset: 0,
        q: "Carolina",
        sort: "name_asc",
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.displayName).toBe("Carolina Price");
      expect(result.rows[0]?.lotCount).toBe(4);
    });

    it("counts only browseable lots (excludes ended)", async () => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new Error("DATABASE_URL required");
      const db = createDb(databaseUrl);
      const rollback = new Error("rollback_browse_lot_count");

      const artistId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      const sellerUserId = "lot-count-int-seller";
      const sellerLeId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
      const activeLotId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
      const endedLotId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

      try {
        await db.transaction(async (tx) => {
          const t = new Date();
          await tx.insert(user).values({
            id: sellerUserId,
            name: "Lot Count Seller",
            email: "lot-count-int-seller@integration.test",
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
          await tx.insert(legalEntity).values({
            id: sellerLeId,
            displayName: "Lot Count Gallery",
            kind: "organisation",
            subkind: "gallery",
            createdByUserId: sellerUserId,
            status: "approved",
            createdAt: t,
            updatedAt: t,
          });
          await tx.insert(artistProfile).values({
            id: artistId,
            displayName: "BrowseCountTest Artist",
            slug: "browse-count-test-artist",
            status: "approved",
            createdAt: t,
            updatedAt: t,
          });

          const lotBase = {
            sellerLegalEntityId: sellerLeId,
            artistId,
            title: "Browse count lot",
            images: [] as string[],
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
            { ...lotBase, id: activeLotId, status: "active" },
            { ...lotBase, id: endedLotId, status: "ended" },
          ]);

          const repo = new DrizzleArtistProfileRepository(tx);
          const result = await repo.listPublicDirectory({
            limit: 5,
            offset: 0,
            q: "BrowseCountTest",
            sort: "name_asc",
          });

          expect(result.rows).toHaveLength(1);
          expect(result.rows[0]?.lotCount).toBe(1);

          throw rollback;
        });
      } catch (e) {
        if (e !== rollback) throw e;
      }
    });
  },
);
