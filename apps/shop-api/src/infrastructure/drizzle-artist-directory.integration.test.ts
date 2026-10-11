import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleArtistDirectoryRepository } from "./drizzle-artist-directory.repository.js";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import { createDrizzleSaleAuthorityWriter } from "./drizzle-sale-authority.writer.js";
import { seedShopFoundationCatalogue } from "./seed/catalogue-seed.js";

describe.skipIf(!hasShopIntegrationDb)("artist directory search", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    const db = createShopDb(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      authorityWriter.grantSaleAuthority.bind(authorityWriter),
    );
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("matches artist names case-insensitively and returns nothing for a miss", async () => {
    const reader = createDrizzleArtistDirectoryRepository(createShopDb(shopPool));

    const hit = await reader.listPublicArtists({ limit: 50, q: "ellison" });
    const miss = await reader.listPublicArtists({ limit: 50, q: "zzqx-no-such-artist-9271" });

    expect(hit.items.map((artist) => artist.slug)).toEqual(["art-foundation-artist"]);
    expect(miss.items).toEqual([]);
  });
});
