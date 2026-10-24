import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { shopArtwork, shopArtworkCategory, shopCategory } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublishedArtworkImportWriter } from "../test-support/shop-fixtures.js";
import { createDrizzleArtworkCatalogueRepository } from "./drizzle-artwork-catalogue.repository.js";

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
    const writer = createPublishedArtworkImportWriter(db);
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
    const writer = createPublishedArtworkImportWriter(db);
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

  it("matches any of several artists and object types", async () => {
    const db = createDbFromPool(shopPool);
    const ownerDb = createDbFromPool(ownerPool);
    const writer = createPublishedArtworkImportWriter(db);
    const repository = createDrizzleArtworkCatalogueRepository(db);
    const suffix = `${Date.now()}-${crypto.randomUUID()}`;
    const seeded = [
      { artist: "a", objectType: "painting" as const },
      { artist: "b", objectType: "print" as const },
      { artist: "c", objectType: "sculpture" as const },
    ];
    const ids: string[] = [];
    for (const [index, row] of seeded.entries()) {
      const created = await writer.importArtwork({
        importKey: `integration:multi:${suffix}:${index}`,
        slug: `integration-multi-${suffix}-${index}`,
        title: `Multi artwork ${index}`,
        description: null,
        primaryImageUrl: null,
        artistSlug: `integration-multi-${row.artist}-${suffix}`,
        artistDisplayName: `Multi Artist ${row.artist}`,
        eligibleForEditionAllocation: false,
      });
      ids.push(created.artworkId);
      await ownerDb
        .update(shopArtwork)
        .set({ objectType: row.objectType })
        .where(eq(shopArtwork.id, created.artworkId));
    }

    try {
      const result = await repository.listPublicArtworks({
        limit: 10,
        filter: {
          artistSlugs: seeded.map((row) => `integration-multi-${row.artist}-${suffix}`),
          objectTypes: ["painting", "print"],
          artworkType: "all",
          sort: "newest",
        },
      });
      expect(result.items.map((item) => item.slug).sort()).toEqual([
        `integration-multi-${suffix}-0`,
        `integration-multi-${suffix}-1`,
      ]);
    } finally {
      await ownerDb.delete(shopArtwork).where(inArray(shopArtwork.id, ids));
    }
  });

  it("lists available works as for sale plus price on request, excluding sold", async () => {
    const db = createDbFromPool(shopPool);
    const writer = createPublishedArtworkImportWriter(db);
    const repository = createDrizzleArtworkCatalogueRepository(db);
    const suffix = `${Date.now()}-${crypto.randomUUID()}`;
    const artist = `Availability Artist ${suffix}`;
    const states = ["for_sale", "price_on_application", "sold"] as const;
    for (const state of states) {
      const { artworkId } = await writer.importArtwork({
        importKey: `integration:available:${suffix}:${state}`,
        slug: `integration-available-${suffix}-${state}`,
        title: `Availability ${state}`,
        description: null,
        primaryImageUrl: null,
        artistSlug: `integration-available-artist-${suffix}`,
        artistDisplayName: artist,
        eligibleForEditionAllocation: false,
      });
      await db.update(shopArtwork).set({ saleState: state }).where(eq(shopArtwork.id, artworkId));
    }

    const result = await repository.listPublicArtworks({
      limit: 10,
      filter: { q: artist, saleState: "available", artworkType: "all", sort: "titleAsc" },
    });

    expect(result.items.map((item) => item.saleState)).toEqual([
      "for_sale",
      "price_on_application",
    ]);
    expect(result.totalCount).toBe(2);
  });

  it("aggregates object type facets per sales channel with the newest cover", async () => {
    const db = createDbFromPool(shopPool);
    const ownerDb = createDbFromPool(ownerPool);
    const writer = createPublishedArtworkImportWriter(db);
    const repository = createDrizzleArtworkCatalogueRepository(db, {
      resolveMediaUrl: (value) => (value ? `https://cdn.test/${value}` : null),
    });
    const suffix = `${Date.now()}-${crypto.randomUUID()}`;
    const sculptureCount = async (salesChannel: "shop" | "art") =>
      (await repository.listObjectTypeFacets({ salesChannel })).find(
        (facet) => facet.objectType === "sculpture",
      )?.artworkCount ?? 0;
    const beforeArt = await sculptureCount("art");
    const beforeShop = await sculptureCount("shop");

    // The image-less row is newest overall and must be skipped when picking the cover.
    const rows = [
      { image: null, createdAt: "2099-06-01T00:00:00.000Z" },
      { image: "older.webp", createdAt: "2099-01-01T00:00:00.000Z" },
      { image: "newest.webp", createdAt: "2099-02-01T00:00:00.000Z" },
    ];
    const ids: string[] = [];
    for (const [index, { image, createdAt }] of rows.entries()) {
      const created = await writer.importArtwork({
        importKey: `integration:facets:${suffix}:${index}`,
        slug: `integration-facets-${suffix}-${index}`,
        title: `Facet artwork ${index}`,
        description: null,
        primaryImageUrl: image,
        artistSlug: `integration-facets-artist-${suffix}`,
        artistDisplayName: "Facet Artist",
        eligibleForEditionAllocation: false,
      });
      ids.push(created.artworkId);
      await ownerDb
        .update(shopArtwork)
        .set({ salesChannel: "art", objectType: "sculpture", createdAt: new Date(createdAt) })
        .where(eq(shopArtwork.id, created.artworkId));
    }

    try {
      const facets = await repository.listObjectTypeFacets({ salesChannel: "art" });
      const sculpture = facets.find((facet) => facet.objectType === "sculpture");
      expect(sculpture?.artworkCount).toBe(beforeArt + 3);
      expect(sculpture?.coverImageUrl).toBe("https://cdn.test/newest.webp");
      expect(await sculptureCount("shop")).toBe(beforeShop);
    } finally {
      await ownerDb.delete(shopArtwork).where(inArray(shopArtwork.id, ids));
    }
  });

  it("hides drafts and archived artworks from the storefront", async () => {
    const db = createDbFromPool(shopPool);
    const writer = createPublishedArtworkImportWriter(db);
    const repository = createDrizzleArtworkCatalogueRepository(db);
    const suffix = `${Date.now()}-${crypto.randomUUID()}`;
    const artist = `Visibility Artist ${suffix}`;
    const slugs = {
      live: `integration-visibility-${suffix}-live`,
      draft: `integration-visibility-${suffix}-draft`,
      archived: `integration-visibility-${suffix}-archived`,
    };
    const base = (key: keyof typeof slugs) => ({
      importKey: `integration:visibility:${suffix}:${key}`,
      slug: slugs[key],
      title: `Visibility ${key}`,
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-visibility-artist-${suffix}`,
      artistDisplayName: artist,
      eligibleForEditionAllocation: false,
    });
    await writer.importArtwork(base("live"));
    await writer.importArtwork({ ...base("draft"), publishOnCreate: false });
    const archived = await writer.importArtwork(base("archived"));
    await db
      .update(shopArtwork)
      .set({ archivedAt: new Date(), publishedAt: null })
      .where(eq(shopArtwork.id, archived.artworkId));

    const result = await repository.listPublicArtworks({
      limit: 10,
      filter: { q: artist, artworkType: "all", sort: "titleAsc" },
    });
    expect(result.items.map((item) => item.slug)).toEqual([slugs.live]);
    expect(result.totalCount).toBe(1);
    expect(await repository.getPublicArtworkBySlug(slugs.live)).not.toBeNull();
    expect(await repository.getPublicArtworkBySlug(slugs.draft)).toBeNull();
    expect(await repository.getPublicArtworkBySlug(slugs.archived)).toBeNull();
  });
});
