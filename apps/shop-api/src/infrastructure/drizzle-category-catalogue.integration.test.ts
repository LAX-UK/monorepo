import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { shopArtwork, shopArtworkCategory, shopCategory } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import { createDrizzleCategoryCatalogueRepository } from "./drizzle-category-catalogue.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

/** Sorts the fixture categories ahead of anything else in a shared test database. */
const FIRST_SORT_ORDER = -2_000_000_000;

describe.skipIf(!ownerUrl || !shopUrl)("drizzle category catalogue", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;
  const categoryIds: string[] = [];

  beforeAll(async () => {
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    const db = createDbFromPool(shopPool);
    if (categoryIds.length > 0) {
      await db
        .delete(shopArtworkCategory)
        .where(inArray(shopArtworkCategory.categoryId, categoryIds));
      await db.delete(shopCategory).where(inArray(shopCategory.id, categoryIds));
    }
    await ownerPool.end();
    await shopPool.end();
  });

  it("lists only categories with a live Shop edition for the Shop channel", async () => {
    const db = createDbFromPool(shopPool);
    const importer = createDrizzleArtworkImportRepository(db, "off");
    const repository = createDrizzleCategoryCatalogueRepository(db);
    const suffix = `${Date.now()}-${crypto.randomUUID()}`;

    async function category(key: string, offset: number) {
      const [row] = await db
        .insert(shopCategory)
        .values({
          slug: `integration-cat-${key}-${suffix}`,
          label: `Integration ${key}`,
          sortOrder: FIRST_SORT_ORDER + offset,
        })
        .returning({ id: shopCategory.id, slug: shopCategory.slug });
      if (!row) throw new Error(`Failed to create category ${key}`);
      categoryIds.push(row.id);
      return row;
    }

    async function artwork(
      key: string,
      categoryId: string,
      options: { edition: boolean; channel: "shop" | "art"; published: boolean },
    ) {
      const created = await importer.importArtwork({
        importKey: `integration:category-catalogue:${suffix}:${key}`,
        slug: `integration-category-catalogue-${suffix}-${key}`,
        title: `Category catalogue ${key}`,
        description: null,
        primaryImageUrl: null,
        artistSlug: `integration-category-artist-${suffix}`,
        artistDisplayName: "Category Artist",
        eligibleForEditionAllocation: options.edition,
        salesChannel: options.channel,
        publishOnCreate: options.published,
        ...(options.edition ? { printPricePence: 5_000 } : {}),
      });
      await db.insert(shopArtworkCategory).values({ artworkId: created.artworkId, categoryId });
      return created.artworkId;
    }

    const editions = await category("editions", 0);
    const originals = await category("originals", 1);
    const artOnly = await category("art-only", 2);
    const archived = await category("archived", 3);
    const empty = await category("empty", 4);

    await artwork("live-edition", editions.id, { edition: true, channel: "shop", published: true });
    await artwork("draft-edition", editions.id, {
      edition: true,
      channel: "shop",
      published: false,
    });
    await artwork("original", originals.id, { edition: false, channel: "shop", published: true });
    await artwork("art-original", artOnly.id, { edition: false, channel: "art", published: true });
    const archivedId = await artwork("archived-edition", archived.id, {
      edition: true,
      channel: "shop",
      published: true,
    });
    await db
      .update(shopArtwork)
      .set({ archivedAt: new Date() })
      .where(eq(shopArtwork.id, archivedId));

    const fixtureSlugs = new Set(
      [editions, originals, artOnly, archived, empty].map((c) => c.slug),
    );
    const pick = (items: Array<{ slug: string; artworkCount: number }>) =>
      items
        .filter((item) => fixtureSlugs.has(item.slug))
        .map((item) => [item.slug, item.artworkCount]);

    const shop = await repository.listPublicCategories({ limit: 50, salesChannel: "shop" });
    expect(pick(shop.items)).toEqual([[editions.slug, 1]]);

    const art = await repository.listPublicCategories({ limit: 50, salesChannel: "art" });
    expect(pick(art.items)).toEqual([[artOnly.slug, 1]]);

    // Without a channel (lax.art's request) the listing is unchanged: every category, all links.
    const all = await repository.listPublicCategories({ limit: 50 });
    expect(pick(all.items)).toEqual([
      [editions.slug, 2],
      [originals.slug, 1],
      [artOnly.slug, 1],
      [archived.slug, 1],
      [empty.slug, 0],
    ]);
  });
});
