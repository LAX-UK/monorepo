import { shopArtwork, shopEdition, shopProduct, shopStaffMember } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublishedArtworkImportWriter } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleSaleAuthorityWriter } from "../drizzle-sale-authority.writer.js";
import {
  SHOP_ACCEPTANCE_MERCH_PRODUCT_SLUG,
  seedAcceptanceStaffOperationsFixtures,
} from "./acceptance-staff-operations-seed.js";
import { seedShopFoundationCatalogue } from "./catalogue-seed.js";

describe.skipIf(!hasShopIntegrationDb)("acceptance staff operations seed", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  const adminSubject = "00000000-0000-4000-8000-000000000202";

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("is idempotent and grants staff plus merchandise fixtures", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createPublishedArtworkImportWriter(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const grantSaleAuthority = authorityWriter.grantSaleAuthority.bind(authorityWriter);

    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      grantSaleAuthority,
    );

    const first = await seedAcceptanceStaffOperationsFixtures(db, {
      adminStaffSubjectId: adminSubject,
    });
    const second = await seedAcceptanceStaffOperationsFixtures(db, {
      adminStaffSubjectId: adminSubject,
    });

    expect(second.holdEditionId).toBe(first.holdEditionId);
    expect(second.customRunHoldEditionId).toBe(first.customRunHoldEditionId);
    const customPrints = await db
      .select({ allocation: shopEdition.allocation, listingStatus: shopEdition.listingStatus })
      .from(shopEdition)
      .innerJoin(shopArtwork, eq(shopArtwork.id, shopEdition.artworkId))
      .where(eq(shopArtwork.slug, first.customRunSlug));
    expect(customPrints).toHaveLength(30);
    expect(customPrints.filter((p) => p.allocation === "original_buyer_entitlement")).toHaveLength(
      6,
    );
    expect(customPrints.filter((p) => p.listingStatus === "authorised")).toHaveLength(6);
    expect(second.merchandiseVariantId).toBe(first.merchandiseVariantId);

    const staff = await db
      .select({ role: shopStaffMember.role })
      .from(shopStaffMember)
      .where(eq(shopStaffMember.identitySubjectId, adminSubject))
      .limit(1);
    expect(staff[0]?.role).toBe("shop_admin");

    const merch = await db
      .select({ slug: shopProduct.slug })
      .from(shopProduct)
      .where(eq(shopProduct.slug, SHOP_ACCEPTANCE_MERCH_PRODUCT_SLUG))
      .limit(1);
    expect(merch.length).toBe(1);
  });
});
