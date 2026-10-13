import { randomUUID } from "node:crypto";
import {
  shopArtist,
  shopArtwork,
  shopArtworkImage,
  shopEditorialPage,
  shopEditorialStory,
  shopMediaAsset,
  shopParty,
} from "@auction/db/schema";
import { eq, inArray, like } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createImportArtworkHandler } from "../../application/handlers/import-artwork.handler.js";
import {
  LEGACY_THELAX_IMPORT_ACTOR,
  importLegacyThelax,
} from "../../application/legacy-thelax/import-legacy-thelax.service.js";
import { createLegacyMediaImporter } from "../../application/legacy-thelax/legacy-media-importer.js";
import { parseLegacyThelaxExport } from "../../application/legacy-thelax/legacy-thelax-export.js";
import { createFakeObjectStorage } from "../../test-support/fake-object-storage.js";
import { legacyThelaxFixture } from "../../test-support/legacy-thelax-fixture.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleArtworkImportRepository } from "../drizzle-artwork-import.repository.js";
import { createDrizzleShopMediaAssetRepository } from "../drizzle-shop-media-asset.repository.js";
import { createSharpImageProbe } from "../sharp-image-probe.js";
import { upsertShopArtist } from "../upsert-shop-artist.js";
import { createDrizzleLegacyThelaxContentStore } from "./drizzle-legacy-thelax-content.store.js";

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe.skipIf(!hasShopIntegrationDb)("legacy thelax import", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("imports every family idempotently, keeps staff edits and emits the redirect map", async () => {
    const db = createShopDb(shopPool);
    const p = `it${randomUUID().slice(0, 8)}`;
    const data = parseLegacyThelaxExport(legacyThelaxFixture(p));
    const image = Buffer.from(ONE_PIXEL_PNG_BASE64, "base64");
    const storage = createFakeObjectStorage();
    const fetched: string[] = [];
    const fetcher = {
      fetch: async (url: string) => {
        fetched.push(url);
        return url.endsWith("-missing.jpg") ? null : image;
      },
    };
    const importArtwork = createImportArtworkHandler(createDrizzleArtworkImportRepository(db));
    const store = createDrizzleLegacyThelaxContentStore(db);
    const run = () =>
      importLegacyThelax(
        {
          importArtwork,
          store,
          media: createLegacyMediaImporter({
            fetcher,
            storage,
            assets: createDrizzleShopMediaAssetRepository(db),
            imageProbe: createSharpImageProbe(),
            actor: LEGACY_THELAX_IMPORT_ACTOR,
          }),
        },
        data,
      );

    await db.delete(shopEditorialPage).where(eq(shopEditorialPage.slug, "faq"));
    await importArtwork({
      importKey: `other:${p}`,
      slug: `${p}-taken`,
      title: "Someone else's work",
      description: null,
      primaryImageUrl: null,
      artistSlug: `${p}-other`,
      artistDisplayName: "Other Artist",
      eligibleForEditionAllocation: false,
    });
    const adaId = await upsertShopArtist(db, {
      slug: `${p}-ada`,
      displayName: "Ada Phantom",
      discipline: "Painter",
      portraitImageUrl: null,
    });
    await db.update(shopArtist).set({ bio: "Staff bio." }).where(eq(shopArtist.id, adaId));

    const first = await run();
    expect(first.report.errors).toEqual([]);
    expect(first.report.artworks).toEqual({
      created: 3,
      updated: 0,
      slugConflicts: [`/collection/${p}-taken.html`],
    });
    expect(first.report.artists).toEqual({ created: 1, updated: 1, unchanged: 0 });
    expect(first.report.stories.created).toBe(1);
    expect(first.report.pages.created).toBe(1);
    expect(first.report.taxonomyPages.created).toBe(1);
    expect(first.report.media.failed).toEqual([
      `https://www.thelax.art/uds/articles/${p}-missing.jpg`,
    ]);

    const artworks = await db
      .select({
        slug: shopArtwork.slug,
        salesChannel: shopArtwork.salesChannel,
        objectType: shopArtwork.objectType,
        rarity: shopArtwork.rarity,
        saleState: shopArtwork.saleState,
        heightCm: shopArtwork.heightCm,
        seoTitle: shopArtwork.seoTitle,
        primaryImageUrl: shopArtwork.primaryImageUrl,
        importKey: shopArtwork.importKey,
      })
      .from(shopArtwork)
      .where(like(shopArtwork.slug, `${p}-%`));
    const bySlug = new Map(artworks.map((row) => [row.slug, row]));
    expect(bySlug.get(`${p}-flower`)).toMatchObject({
      salesChannel: "art",
      objectType: "painting",
      rarity: "unique",
      saleState: "price_on_application",
      heightCm: "70.00",
      seoTitle: "A Flower by Ada Phantom | Art for Sale | LAX",
    });
    expect(bySlug.get(`${p}-flower`)?.primaryImageUrl).toMatch(/^shop\/artwork\/thelax-/);
    expect(bySlug.get(`${p}-flower-print`)).toMatchObject({
      objectType: "print",
      rarity: "limited_edition",
    });
    expect(bySlug.get(`${p}-sold`)?.saleState).toBe("sold");
    expect(bySlug.get(`${p}-taken`)?.importKey).toBe(`other:${p}`);

    const gallery = await db
      .select({ mediaKey: shopArtworkImage.mediaKey })
      .from(shopArtworkImage)
      .innerJoin(shopArtwork, eq(shopArtworkImage.artworkId, shopArtwork.id))
      .where(eq(shopArtwork.slug, `${p}-flower`));
    expect(gallery).toHaveLength(1);

    const [ada] = await db
      .select({
        bio: shopArtist.bio,
        discipline: shopArtist.discipline,
        seoTitle: shopArtist.seoTitle,
        portraitImageUrl: shopArtist.portraitImageUrl,
        displayName: shopParty.displayName,
      })
      .from(shopArtist)
      .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
      .where(eq(shopArtist.id, adaId));
    expect(ada).toMatchObject({
      bio: "Staff bio.",
      discipline: "Painter",
      seoTitle: "Ada Phantom | LAX",
      displayName: "Ada Phantom",
    });
    expect(ada?.portraitImageUrl).toMatch(/^shop\/artist-portrait\/thelax-/);

    const [story] = await db
      .select()
      .from(shopEditorialStory)
      .where(eq(shopEditorialStory.slug, `${p}-story`));
    expect(story).toMatchObject({ status: "published", updatedBy: LEGACY_THELAX_IMPORT_ACTOR });
    expect(story?.coverMediaKey).toMatch(/^shop\/editorial-cover\/thelax-/);
    expect(story?.standfirst).toContain("See the flower");
    const body = story?.bodyBlocks as Array<{ type: string; spans?: unknown; mediaKey?: string }>;
    expect(body.map((block) => block.type)).toEqual(["richText", "image"]);
    expect(body[0]?.spans).toEqual([
      { text: "See " },
      { text: "the flower", href: `/artworks/${p}-flower` },
      { text: ", the " },
      { text: "old sitemap" },
      { text: " and " },
      { text: "an insecure link" },
      { text: " for more about collecting flowers." },
    ]);
    const inlineKey = body[1]?.mediaKey ?? "";
    const [inlineAsset] = await db
      .select({ status: shopMediaAsset.status, kind: shopMediaAsset.kind })
      .from(shopMediaAsset)
      .where(eq(shopMediaAsset.key, inlineKey));
    expect(inlineAsset).toEqual({ status: "active", kind: "editorial_inline" });

    const [taxonomyPage] = await db
      .select({ title: shopEditorialPage.title, bodyBlocks: shopEditorialPage.bodyBlocks })
      .from(shopEditorialPage)
      .where(eq(shopEditorialPage.slug, `style-${p}-surrealism`));
    expect(taxonomyPage?.title).toBe("Surrealism art");
    expect(taxonomyPage?.bodyBlocks).toContainEqual({
      type: "artworkRail",
      headline: "Works in the collection",
      artworkSlugs: [`${p}-flower`, `${p}-flower-print`, `${p}-sold`],
    });

    expect(first.redirects).toMatchObject({
      [`/collection/${p}-flower.html`]: `/artworks/${p}-flower`,
      [`/print/${p}-flower.html`]: `/artworks/${p}-flower-print`,
      [`/collections/${p}-bo.html`]: `/artists/${p}-bo`,
      [`/art-collection/${p}-blooms.html`]: `/artists/${p}-ada`,
      [`/news/${p}-story.html`]: `/stories/${p}-story`,
      "/faq": "/collector-hub/faq",
      [`/uds/stock/${p}-flower.jpg`]: expect.stringMatching(
        /^https:\/\/cdn\.test\/shop\/artwork\/thelax-/,
      ),
    });
    expect(first.redirects).not.toHaveProperty(`/collection/${p}-taken.html`);

    const fetchesAfterFirst = fetched.length;
    const second = await run();
    expect(second.report.errors).toEqual([]);
    expect(second.report.artworks).toMatchObject({ created: 0, updated: 3 });
    expect(second.report.artists).toEqual({ created: 0, updated: 0, unchanged: 2 });
    expect(second.report.stories.updated).toBe(1);
    expect(second.report.media.imported).toBe(0);
    expect(fetched.length - fetchesAfterFirst).toBe(1);
    expect(second.redirects).toEqual(first.redirects);

    await db
      .update(shopEditorialStory)
      .set({ title: "Staff title", updatedBy: "staff-subject" })
      .where(eq(shopEditorialStory.slug, `${p}-story`));
    const third = await run();
    expect(third.report.stories).toMatchObject({ kept_staff_edit: 1, updated: 0 });
    const [kept] = await db
      .select({ title: shopEditorialStory.title })
      .from(shopEditorialStory)
      .where(eq(shopEditorialStory.slug, `${p}-story`));
    expect(kept?.title).toBe("Staff title");

    await db
      .delete(shopEditorialPage)
      .where(inArray(shopEditorialPage.slug, ["faq", `style-${p}-surrealism`]));
  });
});
