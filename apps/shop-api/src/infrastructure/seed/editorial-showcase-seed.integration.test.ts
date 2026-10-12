import {
  shopEditorialExhibition,
  shopEditorialPage,
  shopEditorialPlacement,
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
});
