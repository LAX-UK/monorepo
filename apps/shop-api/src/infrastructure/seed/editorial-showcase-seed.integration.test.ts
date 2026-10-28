import {
  shopEditorialExhibition,
  shopEditorialPage,
  shopEditorialPlacement,
  shopHelpArticle,
  shopHelpCategory,
} from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { seedEditorialShowcase } from "./editorial-showcase-seed.js";

describe.skipIf(!hasShopIntegrationDb)("editorial showcase seed", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("publishes guide, legal and Collector Hub pages plus featured shows (idempotent)", async () => {
    const db = createShopDb(shopPool);
    await seedEditorialShowcase(db);
    await seedEditorialShowcase(db);

    const pages = await db
      .select({ slug: shopEditorialPage.slug, status: shopEditorialPage.status })
      .from(shopEditorialPage)
      .where(
        inArray(shopEditorialPage.slug, ["how-to-buy", "how-to-sell", "101-guide", "privacy"]),
      );
    expect(pages).toHaveLength(4);
    expect(pages.every((page) => page.status === "published")).toBe(true);

    const featured = await db
      .select({ slug: shopEditorialExhibition.slug })
      .from(shopEditorialExhibition)
      .where(eq(shopEditorialExhibition.featured, true));
    expect(featured.map((row) => row.slug)).toEqual(
      expect.arrayContaining(["showcase-new-originals", "showcase-form-and-fold"]),
    );

    const hubCards = await db
      .select({ refKind: shopEditorialPlacement.refKind })
      .from(shopEditorialPlacement)
      .where(eq(shopEditorialPlacement.slot, "collector_hub_card"));
    expect(hubCards.filter((card) => card.refKind === "page")).toHaveLength(2);
  });

  it("fills the Art Hub podcast, film and press slots and retires the product promo copy", async () => {
    const db = createShopDb(shopPool);
    await db.insert(shopEditorialPlacement).values({
      slot: "home_promo_bid",
      position: 0,
      refKind: "external",
      headline: "Old promo",
      linkUrl: "https://lax.bid",
      publishedAt: new Date(),
    });
    await seedEditorialShowcase(db);

    const slots = await db
      .select({ slot: shopEditorialPlacement.slot })
      .from(shopEditorialPlacement);
    const present = new Set(slots.map((row) => row.slot));
    for (const slot of ["art_hub_podcast", "art_hub_films", "art_hub_press"] as const) {
      expect(present.has(slot)).toBe(true);
    }
    expect(present.has("home_promo_bid")).toBe(false);
    expect(present.has("home_promo_shop")).toBe(false);
  });

  it("seeds five published help categories with their questions (idempotent)", async () => {
    const db = createShopDb(shopPool);
    await seedEditorialShowcase(db);
    await seedEditorialShowcase(db);

    const categories = await db
      .select({ slug: shopHelpCategory.slug, status: shopHelpCategory.status })
      .from(shopHelpCategory)
      .where(
        inArray(shopHelpCategory.slug, [
          "buying",
          "shipping-and-delivery",
          "returns",
          "private-viewings",
          "your-account",
        ]),
      );
    expect(categories).toHaveLength(5);
    expect(categories.every((category) => category.status === "published")).toBe(true);

    const questions = await db
      .select({ slug: shopHelpArticle.slug, answerText: shopHelpArticle.answerText })
      .from(shopHelpArticle)
      .where(inArray(shopHelpArticle.slug, ["how-do-i-buy-an-artwork", "can-i-return-an-artwork"]));
    expect(questions).toHaveLength(2);
    expect(questions.every((question) => question.answerText.length > 0)).toBe(true);
  });
});
