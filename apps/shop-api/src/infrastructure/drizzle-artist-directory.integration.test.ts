import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublishedArtworkImportWriter } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleArtistDirectoryRepository } from "./drizzle-artist-directory.repository.js";
import { createDrizzleSaleAuthorityWriter } from "./drizzle-sale-authority.writer.js";
import { seedShopFoundationCatalogue } from "./seed/catalogue-seed.js";

describe.skipIf(!hasShopIntegrationDb)("artist directory search", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    const db = createShopDb(shopPool);
    const importWriter = createPublishedArtworkImportWriter(db, "off");
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
    expect(hit.total).toBe(1);
    expect(miss.items).toEqual([]);
    expect(miss.total).toBe(0);
  });

  it("pages an A–Z list by name without repeating or skipping artists", async () => {
    const reader = createDrizzleArtistDirectoryRepository(createShopDb(shopPool));

    const all = await reader.listPublicArtists({ limit: 50, sort: "nameAsc" });
    const first = await reader.listPublicArtists({ limit: 1, sort: "nameAsc" });
    expect(first.total).toBe(all.total);
    if (all.items.length < 2) return;
    expect(first.nextNameCursor).toBeDefined();

    const second = await reader.listPublicArtists({
      limit: 1,
      sort: "nameAsc",
      ...(first.nextNameCursor ? { nameCursor: first.nextNameCursor } : {}),
    });
    expect([...first.items, ...second.items].map((artist) => artist.slug)).toEqual(
      all.items.slice(0, 2).map((artist) => artist.slug),
    );
  });
});
