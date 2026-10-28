import { GALLERY_CONTACT } from "@auction/branding";
import {
  shopArtist,
  shopEditorialExhibition,
  shopEditorialExhibitionArtist,
  shopEditorialStory,
} from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
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

describe.skipIf(!hasShopIntegrationDb)("editorial content fields", () => {
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

  it("filters stories by category, treating a blank category as its kind's default", async () => {
    const repo = repository();
    const guides = await repo.listStories({ category: "collecting_guide" });
    // The seeded guide has no category set; kind "guide" defaults to "collecting_guide".
    expect(guides.map((story) => story.slug)).toContain("showcase-collecting-guide");
    expect(guides.every((story) => story.category === "collecting_guide")).toBe(true);

    const podcasts = await repo.listStories({ category: "podcast" });
    expect(podcasts.map((story) => story.slug)).toEqual(["showcase-podcast-studio-light"]);
    expect(podcasts[0]).toMatchObject({
      kind: "podcast",
      series: "In the studio",
      episodeNumber: 4,
      durationSeconds: 2778,
    });

    const series = await repo.listStories({ series: "Collecting guide" });
    expect(series.map((story) => story.slug)).toEqual(["showcase-collecting-guide"]);
  });

  it("returns press publication details and podcast audio on story detail", async () => {
    const repo = repository();
    const press = await repo.getStoryBySlug("showcase-press-new-originals");
    expect(press).toMatchObject({
      category: "press",
      publicationName: "Art Plugged",
      externalUrl: "https://example.com/art-plugged/new-originals",
    });
    const podcast = await repo.getStoryBySlug("showcase-podcast-studio-light");
    expect(podcast?.audioUrl).toBe("https://media.lax.art/podcast/studio-light.mp3");
  });

  it("stores a read-time estimate on save and keeps an editor override separate", async () => {
    const repo = repository();
    const created = await repo.createStory({
      slug: "read-time-check-5521",
      kind: "article",
      title: "Read time check",
      standfirst: null,
      coverMediaKey: null,
      videoUrl: null,
      featured: false,
      body: [{ type: "richText", spans: [{ text: "word ".repeat(700).trim() }] }],
      updatedBy: "test",
    });
    try {
      await repo.setStoryPublication(created.id, true, "test");
      const estimated = (await repo.listStories()).find(
        (story) => story.slug === "read-time-check-5521",
      );
      expect(estimated?.readMinutes).toBe(4);

      await repo.updateStory(created.id, {
        slug: "read-time-check-5521",
        kind: "article",
        title: "Read time check",
        standfirst: null,
        coverMediaKey: null,
        videoUrl: null,
        featured: false,
        body: [{ type: "richText", spans: [{ text: "short" }] }],
        readMinutes: 9,
        expectedVersion: (await repo.getAdminStoryById(created.id))?.updatedAt ?? "",
        updatedBy: "test",
      });
      const admin = await repo.getAdminStoryById(created.id);
      expect(admin?.readMinutes).toBe(9);
      const overridden = await repo.getStoryBySlug("read-time-check-5521");
      expect(overridden?.readMinutes).toBe(9);

      // Omitting the override (an older admin client) leaves it unchanged.
      await repo.updateStory(created.id, {
        slug: "read-time-check-5521",
        kind: "article",
        title: "Read time check",
        standfirst: null,
        coverMediaKey: null,
        videoUrl: null,
        featured: false,
        body: [{ type: "richText", spans: [{ text: "short" }] }],
        expectedVersion: (await repo.getAdminStoryById(created.id))?.updatedAt ?? "",
        updatedBy: "test",
      });
      expect((await repo.getAdminStoryById(created.id))?.readMinutes).toBe(9);
    } finally {
      await createShopDb(shopPool)
        .delete(shopEditorialStory)
        .where(eq(shopEditorialStory.id, created.id));
    }
  });

  it("orders exhibition artists by the editor's position before name", async () => {
    const db = createShopDb(shopPool);
    const before = await repository().getExhibitionBySlug("showcase-new-originals");
    const names = before?.artists.map((artist) => artist.slug) ?? [];
    expect(names.length).toBeGreaterThan(1);
    const last = names[names.length - 1] as string;
    const [exhibition] = await db
      .select({ id: shopEditorialExhibition.id })
      .from(shopEditorialExhibition)
      .where(eq(shopEditorialExhibition.slug, "showcase-new-originals"));
    const [artist] = await db
      .select({ id: shopArtist.id })
      .from(shopArtist)
      .where(eq(shopArtist.slug, last));
    if (!exhibition || !artist) throw new Error("seeded exhibition or artist missing");
    const join = and(
      eq(shopEditorialExhibitionArtist.exhibitionId, exhibition.id),
      eq(shopEditorialExhibitionArtist.artistId, artist.id),
    );
    const [original] = await db
      .select({ position: shopEditorialExhibitionArtist.position })
      .from(shopEditorialExhibitionArtist)
      .where(join);
    await db.update(shopEditorialExhibitionArtist).set({ position: -1 }).where(join);
    try {
      const after = await repository().getExhibitionBySlug("showcase-new-originals");
      expect(after?.artists[0]?.slug).toBe(last);
    } finally {
      await db
        .update(shopEditorialExhibitionArtist)
        .set({ position: original?.position ?? 0 })
        .where(join);
    }
  });

  it("returns venue address lines, exhibition subtitle and contact, and placement copy", async () => {
    const repo = repository();
    const [venue] = await repo.listVenues();
    expect(venue).toMatchObject({
      streetLine: GALLERY_CONTACT.streetLine,
      postcode: GALLERY_CONTACT.postcode,
      city: "London",
    });
    const detail = await repo.getVenueBySlug("lax-marylebone");
    expect(detail?.latitude).toBeCloseTo(51.5201, 4);

    const exhibition = await repo.getExhibitionBySlug("showcase-new-originals");
    expect(exhibition?.subtitle).toBe("Selling exhibition");
    expect(exhibition?.contact).toMatchObject({
      name: "Elena Wendy",
      role: "Exhibition specialist",
    });

    const placements = await repo.getHomePlacements();
    expect(placements.find((p) => p.slot === "home_hero")).toMatchObject({
      headline: "New Originals, now on in Marylebone",
    });
    expect(placements.some((p) => p.slot.startsWith("home_promo_"))).toBe(false);
  });
});
