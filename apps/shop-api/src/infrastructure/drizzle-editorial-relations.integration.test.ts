import {
  shopArtwork,
  shopEditorialExhibition,
  shopEditorialStory,
  shopEditorialVenue,
} from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublishedArtworkImportWriter } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleEditorialRepository } from "./drizzle-editorial.repository.js";
import { createDrizzleSaleAuthorityWriter } from "./drizzle-sale-authority.writer.js";
import { seedShopFoundationCatalogue } from "./seed/catalogue-seed.js";
import { seedEditorialShowcase } from "./seed/editorial-showcase-seed.js";

describe.skipIf(!hasShopIntegrationDb)("editorial relations", () => {
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
    await seedEditorialShowcase(db);
    // Re-running proves the join rows are replaced rather than duplicated.
    await seedEditorialShowcase(db);
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function repository() {
    return createDrizzleEditorialRepository(createShopDb(shopPool), {
      resolveMediaUrl: (value) => value ?? null,
    });
  }

  it("returns exhibition works in curated order with their artists, stories and venue", async () => {
    const exhibition = await repository().getExhibitionBySlug("showcase-new-originals");

    expect(exhibition?.venue).toEqual({ slug: "lax-marylebone", name: "LAX Marylebone" });
    expect(exhibition?.artworks.map((work) => work.slug)).toEqual([
      "quiet-orchard",
      "tidal-forms",
      "harbour-light",
      "marylebone-dusk",
    ]);
    expect(exhibition?.artworks.every((work) => work.salesChannel === "art")).toBe(true);
    const artistSlugs = exhibition?.artists.map((artist) => artist.slug) ?? [];
    expect(artistSlugs).toContain("art-foundation-artist");
    expect(exhibition?.artists[0]).toHaveProperty("nationality");
    expect(exhibition?.stories.map((story) => story.slug)).toEqual(["showcase-welcome"]);
  });

  it("hides shop-channel works, unpublished stories and unpublished venues", async () => {
    const db = createShopDb(shopPool);
    await db
      .update(shopArtwork)
      .set({ salesChannel: "shop" })
      .where(eq(shopArtwork.slug, "quiet-orchard"));
    await db
      .update(shopEditorialStory)
      .set({ status: "draft" })
      .where(eq(shopEditorialStory.slug, "showcase-welcome"));
    await db
      .update(shopEditorialVenue)
      .set({ status: "draft" })
      .where(eq(shopEditorialVenue.slug, "lax-marylebone"));
    try {
      const repo = repository();
      const exhibition = await repo.getExhibitionBySlug("showcase-new-originals");
      expect(exhibition?.artworks.map((work) => work.slug)).not.toContain("quiet-orchard");
      expect(exhibition?.stories).toEqual([]);
      expect(exhibition?.venue).toBeNull();
      const [summary] = (await repo.listExhibitions("current")).filter(
        (item) => item.slug === "showcase-new-originals",
      );
      expect(summary?.venue).toBeNull();
    } finally {
      await db
        .update(shopArtwork)
        .set({ salesChannel: "art" })
        .where(eq(shopArtwork.slug, "quiet-orchard"));
      await db
        .update(shopEditorialStory)
        .set({ status: "published" })
        .where(eq(shopEditorialStory.slug, "showcase-welcome"));
      await db
        .update(shopEditorialVenue)
        .set({ status: "published" })
        .where(eq(shopEditorialVenue.slug, "lax-marylebone"));
    }
  });

  it("returns story publishedAt and related artists, works and exhibitions", async () => {
    const repo = repository();
    const story = await repo.getStoryBySlug("showcase-welcome");

    expect(story?.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(story?.related.artists.map((artist) => artist.slug).sort()).toEqual(
      ["art-foundation-artist", "ines-okafor", "theo-marsh"].sort(),
    );
    expect(story?.related.artworks).toHaveLength(2);
    expect(story?.related.exhibitions.map((item) => item.slug).sort()).toEqual(
      ["showcase-form-and-fold", "showcase-new-originals"].sort(),
    );
    const listed = (await repo.listStories()).find((item) => item.slug === "showcase-welcome");
    expect(listed?.publishedAt).toBe(story?.publishedAt);
  });

  it("returns an artist's published exhibitions and stories, and null for an unknown artist", async () => {
    const repo = repository();
    const relations = await repo.getArtistRelations("theo-marsh");

    expect(relations?.exhibitions.map((item) => item.slug)).toEqual(["showcase-form-and-fold"]);
    expect(relations?.stories.map((item) => item.slug)).toEqual(["showcase-welcome"]);
    expect(await repo.getArtistRelations("no-such-artist-7731")).toBeNull();
  });

  it("drops draft exhibitions from an artist's relations", async () => {
    const db = createShopDb(shopPool);
    await db
      .update(shopEditorialExhibition)
      .set({ status: "draft" })
      .where(eq(shopEditorialExhibition.slug, "showcase-form-and-fold"));
    try {
      const relations = await repository().getArtistRelations("theo-marsh");
      expect(relations?.exhibitions).toEqual([]);
    } finally {
      await db
        .update(shopEditorialExhibition)
        .set({ status: "published" })
        .where(eq(shopEditorialExhibition.slug, "showcase-form-and-fold"));
    }
  });
});
