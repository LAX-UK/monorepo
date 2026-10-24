import { shopCategory } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleStorefrontCurationWriter } from "../drizzle-storefront-curation.repository.js";
import { seedShopStorefrontCuration } from "./storefront-curation-seed.js";

describe.skipIf(!hasShopIntegrationDb)("storefront curation seed", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    const db = createShopDb(shopPool);
    await db.delete(shopCategory).where(eq(shopCategory.slug, "coins-medals"));
    await shopPool.end();
    await ownerPool.end();
  });

  it("replaces the seeded Bid taxonomy but keeps a staff-curated category with a retired slug", async () => {
    const db = createShopDb(shopPool);
    await db.delete(shopCategory).where(inArray(shopCategory.slug, ["watches", "coins-medals"]));
    await db.insert(shopCategory).values([
      { slug: "watches", label: "Watches", coverImageUrl: "/shop/home/category-watches.webp" },
      {
        slug: "coins-medals",
        label: "Coins & Medals",
        coverImageUrl: "https://media.example.test/uploads/coins.webp",
      },
    ]);

    await seedShopStorefrontCuration(db, createDrizzleStorefrontCurationWriter);
    await seedShopStorefrontCuration(db, createDrizzleStorefrontCurationWriter);

    const rows = await db
      .select({ slug: shopCategory.slug, label: shopCategory.label })
      .from(shopCategory)
      .where(inArray(shopCategory.slug, ["prints", "originals", "watches", "coins-medals"]));
    expect(rows.map((row) => row.slug).sort()).toEqual(["coins-medals", "prints"]);
    expect(rows.find((row) => row.slug === "prints")?.label).toBe("Limited edition prints");
  });
});
