import { shopArtwork } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleArtworkImportRepository } from "../drizzle-artwork-import.repository.js";
import { createDrizzleSaleAuthorityWriter } from "../drizzle-sale-authority.writer.js";
import { ART_SEED_ORIGINAL_SLUGS, seedShopFoundationCatalogue } from "./catalogue-seed.js";

describe.skipIf(!hasShopIntegrationDb)("foundation catalogue seed", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("seeds lax.art originals on the art sales channel with a medium (idempotent)", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const seed = () =>
      seedShopFoundationCatalogue(
        importWriter.importArtwork.bind(importWriter),
        db,
        authorityWriter.grantSaleAuthority.bind(authorityWriter),
      );

    await seed();
    await seed();

    const rows = await db
      .select({
        slug: shopArtwork.slug,
        salesChannel: shopArtwork.salesChannel,
        medium: shopArtwork.medium,
      })
      .from(shopArtwork)
      .where(inArray(shopArtwork.slug, [...ART_SEED_ORIGINAL_SLUGS]));

    expect(rows).toHaveLength(ART_SEED_ORIGINAL_SLUGS.length);
    for (const row of rows) {
      expect(row.salesChannel).toBe("art");
      expect(row.medium).toBeTruthy();
    }
  });
});
