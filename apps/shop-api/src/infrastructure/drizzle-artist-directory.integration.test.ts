import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublishedArtworkImportWriter,
  integrationSuffix,
} from "../test-support/shop-fixtures.js";
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

  it("keeps only artists with a work on sale now, newest listing first", async () => {
    const db = createShopDb(shopPool);
    const reader = createDrizzleArtistDirectoryRepository(db);
    const writer = createPublishedArtworkImportWriter(db, "off");
    const suffix = integrationSuffix("artists-available");
    const importFor = (artist: string, options: { edition: boolean }) =>
      writer.importArtwork({
        importKey: `integration:${artist}:${suffix}`,
        publishOnCreate: true,
        slug: `integration-${artist}-${suffix}`,
        title: `Integration ${artist}`,
        description: null,
        primaryImageUrl: null,
        saleState: "for_sale",
        artistSlug: `integration-${artist}-${suffix}`,
        artistDisplayName: `Integration ${artist}`,
        // An edition with no sale authority has nothing to sell; an original on sale does.
        eligibleForEditionAllocation: options.edition,
        printPricePence: 5_000,
      });
    await importFor("nothing-on-sale", { edition: true });
    await importFor("earlier", { edition: false });
    await importFor("later", { edition: false });
    const slug = (artist: string) => `integration-${artist}-${suffix}`;

    const every = await reader.listPublicArtists({ limit: 50, q: suffix });
    const available = await reader.listPublicArtists({
      limit: 50,
      q: suffix,
      hasAvailableEditions: true,
      sort: "latestEdition",
    });

    expect(every.items.map((artist) => artist.slug)).toContain(slug("nothing-on-sale"));
    expect(available.items.map((artist) => artist.slug)).toEqual([slug("later"), slug("earlier")]);
    expect(available.total).toBe(2);
    expect(available.nextCursor).toBeUndefined();
  });
});
