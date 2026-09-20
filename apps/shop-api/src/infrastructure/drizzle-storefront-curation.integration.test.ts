import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { shopCategory, shopHomePlacement } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import { createDrizzleStorefrontCurationWriter } from "./drizzle-storefront-curation.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

describe.skipIf(!ownerUrl || !shopUrl)("drizzle storefront curation", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl || !shopUrl) throw new Error("Shop integration database URLs are required");
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("replaces declared slots transactionally without deleting other slots", async () => {
    const db = createDbFromPool(shopPool);
    const importer = createDrizzleArtworkImportRepository(db);
    const writer = createDrizzleStorefrontCurationWriter(db);
    const suffix = `${Date.now()}-${crypto.randomUUID()}`;
    const artwork = await importer.importArtwork({
      importKey: `integration:curation:${suffix}`,
      slug: `curation-artwork-${suffix}`,
      title: "Curated artwork",
      description: null,
      primaryImageUrl: null,
      artistSlug: `curation-artist-${suffix}`,
      artistDisplayName: "Curation Artist",
      eligibleForEditionAllocation: false,
    });
    const [firstCategory, secondCategory] = await db
      .insert(shopCategory)
      .values([
        { slug: `curation-first-${suffix}`, label: "First category" },
        { slug: `curation-second-${suffix}`, label: "Second category" },
      ])
      .returning({ id: shopCategory.id });
    if (!firstCategory || !secondCategory) {
      throw new Error("Failed to create curation categories");
    }
    const publishedAt = new Date();

    await writer.replaceHomePlacements({
      slots: ["featured_originals", "featured_categories"],
      placements: [
        {
          slot: "featured_originals",
          position: 0,
          target: { kind: "artwork", id: artwork.artworkId },
        },
        {
          slot: "featured_categories",
          position: 0,
          target: { kind: "category", id: firstCategory.id },
        },
      ],
      publishedAt,
    });
    await writer.replaceHomePlacements({
      slots: ["featured_categories"],
      placements: [
        {
          slot: "featured_categories",
          position: 0,
          target: { kind: "category", id: secondCategory.id },
        },
      ],
      publishedAt,
    });
    await expect(
      writer.replaceHomePlacements({
        slots: ["featured_categories"],
        placements: [
          {
            slot: "featured_categories",
            position: 0,
            target: { kind: "category", id: crypto.randomUUID() },
          },
        ],
        publishedAt,
      }),
    ).rejects.toThrow();

    const rows = await db
      .select({
        slot: shopHomePlacement.slot,
        artworkId: shopHomePlacement.artworkId,
        categoryId: shopHomePlacement.categoryId,
      })
      .from(shopHomePlacement)
      .where(eq(shopHomePlacement.position, 0));
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slot: "featured_originals",
          artworkId: artwork.artworkId,
        }),
        expect.objectContaining({
          slot: "featured_categories",
          categoryId: secondCategory.id,
        }),
      ]),
    );
  });
});
