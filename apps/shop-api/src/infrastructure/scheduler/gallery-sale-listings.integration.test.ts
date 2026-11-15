import { createDbFromPool } from "@auction/db";
import { shopAdminAudit, shopArtwork } from "@auction/db/schema";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleSoldAttentionStore,
} from "@auction/persistence/repositories";
import { and, eq, sql } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  importTestArtwork,
  integrationSuffix,
  uniqueStockCode,
} from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createGallerySaleListingsRunner } from "./gallery-sale-listings.runner.js";

const NOW = new Date("2026-11-15T10:00:00.000Z");

describe.skipIf(!hasShopIntegrationDb)(
  "gallery sale takes lax.art listings off sale (Postgres)",
  () => {
    let shopPool: pg.Pool;
    let ownerPool: pg.Pool;

    beforeAll(async () => {
      ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    });

    const registerIds: string[] = [];

    // Items reference the register (ON DELETE RESTRICT): leave none behind for other tests.
    afterAll(async () => {
      const owner = createDbFromPool(ownerPool);
      for (const id of registerIds) {
        await owner.execute(
          sql`DELETE FROM artwork_register_sold_attention WHERE register_id = ${id}`,
        );
      }
      await shopPool.end();
      await ownerPool.end();
    });

    /** A published listing linked to a register record Zoho shows with `status`. */
    async function linkedListing(status: string) {
      const db = createShopDb(shopPool);
      const register = new DrizzleArtworkRegisterRepository(createDbFromPool(ownerPool));
      const suffix = integrationSuffix("gs");
      const created = await register.create(
        {
          zohoProductId: `zoho-${suffix}`,
          stockCode: uniqueStockCode("original"),
          kind: "original",
          sourceOriginalId: null,
          title: "Harbour light",
          artist: { zohoArtistId: "77", name: "Ada Rowe", code: "ROW" },
          medium: null,
          dimensions: null,
          year: null,
          imageRefs: [],
          catalogueStatus: status,
        },
        "zoho",
        NOW,
      );
      if (!created.ok) throw new Error(created.reason);
      registerIds.push(created.entry.id);
      const listing = await importTestArtwork(db, "gallery-sale");
      await db
        .update(shopArtwork)
        .set({ zohoProductId: created.entry.zohoProductId })
        .where(eq(shopArtwork.id, listing.artworkId));
      return { db, register, entry: created.entry, artworkId: listing.artworkId };
    }

    async function published(db: ReturnType<typeof createShopDb>, artworkId: string) {
      const [row] = await db
        .select({ publishedAt: shopArtwork.publishedAt, archivedAt: shopArtwork.archivedAt })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, artworkId));
      return row?.publishedAt !== null && row?.archivedAt === null;
    }

    it("unpublishes a listing once the register records the gallery sale, once, with an audit row", async () => {
      const { db, register, entry, artworkId } = await linkedListing("Sold");
      const run = createGallerySaleListingsRunner(db);

      await run(NOW);
      expect(await published(db, artworkId)).toBe(true);

      expect((await register.recordGallerySale({ registerId: entry.id, now: NOW })).status).toBe(
        "recorded",
      );
      await run(NOW);
      expect(await published(db, artworkId)).toBe(false);
      await run(NOW);

      const audit = await db
        .select()
        .from(shopAdminAudit)
        .where(
          and(
            eq(shopAdminAudit.targetId, artworkId),
            eq(shopAdminAudit.action, "unpublish_artwork"),
          ),
        );
      expect(audit).toHaveLength(1);
      expect(audit[0]?.actorSubjectId).toBe("system:shop-scheduler");
      expect(JSON.stringify(audit[0]?.afterJson)).toContain("sold_in_gallery");
    });

    it("leaves a listing alone while Zoho's Sold is not recorded (a dry run changes nothing)", async () => {
      const { db, artworkId } = await linkedListing("Sold");
      await createGallerySaleListingsRunner(db)(NOW);
      expect(await published(db, artworkId)).toBe(true);
    });

    it("lets LAX Admin (as shop_app) mark the item dealt with and reopen, putting nothing back on sale", async () => {
      const { db, register, entry, artworkId } = await linkedListing("Sold");
      const owner = new DrizzleSoldAttentionStore(createDbFromPool(ownerPool));
      await owner.raise({
        registerId: entry.id,
        zohoProductId: entry.zohoProductId,
        zohoStatus: "Sold",
        place: "lax_art",
        placeRefId: artworkId,
        markedAt: NOW,
        now: NOW,
      });
      await register.recordGallerySale({ registerId: entry.id, now: NOW });
      const asShop = new DrizzleSoldAttentionStore(db);
      const item = await asShop.findLive(entry.id);
      expect(await asShop.isPaused({ registerId: entry.id })).toBe(true);
      expect(
        (await asShop.markDealtWith({ id: item?.id ?? "", actor: "staff:s1", now: NOW })).ok,
      ).toBe(true);
      expect(await asShop.isPaused({ registerId: entry.id })).toBe(false);
      await createGallerySaleListingsRunner(db)(NOW);
      await createDbFromPool(ownerPool).execute(
        sql`UPDATE artwork_register SET catalogue_status = 'Available' WHERE id = ${entry.id}`,
      );
      const reopened = await new DrizzleArtworkRegisterRepository(db).reopenGallerySale({
        registerId: entry.id,
        reason: "Marked in Zoho by mistake",
        actor: "staff:admin",
        now: NOW,
      });
      expect(reopened.ok).toBe(true);
      await createGallerySaleListingsRunner(db)(NOW);
      expect(await published(db, artworkId)).toBe(false);
    });
  },
);
