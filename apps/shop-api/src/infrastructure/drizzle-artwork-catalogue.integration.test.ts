import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { shopArtwork, shopArtworkCategory, shopCategory } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleArtworkCatalogueRepository } from "./drizzle-artwork-catalogue.repository.js";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

describe.skipIf(!ownerUrl || !shopUrl)("drizzle artwork catalogue", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("filters by category and paginates equal timestamps without skipping rows", async () => {
    const db = createDbFromPool(shopPool);
    const writer = createDrizzleArtworkImportRepository(db);
    const repository = createDrizzleArtworkCatalogueRepository(db);
    const suffix = `${Date.now()}-${crypto.randomUUID()}`;
    const categorySlug = `integration-category-${suffix}`;
    const first = await writer.importArtwork({
      importKey: `integration:catalogue:${suffix}:first`,
      slug: `integration-catalogue-${suffix}-first`,
      title: "First catalogue artwork",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-catalogue-artist-${suffix}`,
      artistDisplayName: "Catalogue Artist",
      eligibleForEditionAllocation: false,
    });
    const second = await writer.importArtwork({
      importKey: `integration:catalogue:${suffix}:second`,
      slug: `integration-catalogue-${suffix}-second`,
      title: "Second catalogue artwork",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-catalogue-artist-${suffix}`,
      artistDisplayName: "Catalogue Artist",
      eligibleForEditionAllocation: false,
    });
    const [category] = await db
      .insert(shopCategory)
      .values({ slug: categorySlug, label: "Integration category" })
      .returning({ id: shopCategory.id });
    if (!category) throw new Error("Failed to create integration category");

    await db.insert(shopArtworkCategory).values([
      { artworkId: first.artworkId, categoryId: category.id },
      { artworkId: second.artworkId, categoryId: category.id },
    ]);
    const sharedCreatedAt = new Date("2026-09-15T12:00:00.000Z");
    await db
      .update(shopArtwork)
      .set({ createdAt: sharedCreatedAt })
      .where(inArray(shopArtwork.id, [first.artworkId, second.artworkId]));

    const pageOne = await repository.listPublicArtworks({
      limit: 1,
      filter: { categorySlug, artworkType: "all", sort: "newest" },
    });
    if (!pageOne.nextCursor) throw new Error("Expected a second catalogue page");
    const pageTwo = await repository.listPublicArtworks({
      limit: 1,
      cursor: pageOne.nextCursor,
      filter: { categorySlug, artworkType: "all", sort: "newest" },
    });

    expect(pageOne.items).toHaveLength(1);
    expect(pageOne.nextCursor).toBeTruthy();
    expect(pageTwo.items).toHaveLength(1);
    expect(pageTwo.items[0]?.slug).not.toBe(pageOne.items[0]?.slug);

    await db.delete(shopArtworkCategory).where(eq(shopArtworkCategory.categoryId, category.id));
    await db.delete(shopCategory).where(eq(shopCategory.id, category.id));
  });

  it("filters artworks by artist display name text search", async () => {
    const db = createDbFromPool(shopPool);
    const writer = createDrizzleArtworkImportRepository(db);
    const repository = createDrizzleArtworkCatalogueRepository(db);
    const suffix = `${Date.now()}-${crypto.randomUUID()}`;
    const uniqueArtist = `Unique Search Artist ${suffix}`;
    await writer.importArtwork({
      importKey: `integration:search:${suffix}`,
      slug: `integration-search-${suffix}`,
      title: "Search target artwork",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-search-artist-${suffix}`,
      artistDisplayName: uniqueArtist,
      eligibleForEditionAllocation: false,
    });

    const result = await repository.listPublicArtworks({
      limit: 10,
      filter: { q: uniqueArtist, artworkType: "all", sort: "newest" },
    });

    expect(result.items.some((item) => item.slug === `integration-search-${suffix}`)).toBe(true);
  });
});
