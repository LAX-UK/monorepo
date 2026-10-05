import {
  shopArtwork,
  shopBasket,
  shopBasketLine,
  shopEdition,
  shopOrder,
} from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPendingPaymentOrderWithReservedEdition,
  integrationSuffix,
} from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleArtworkImportRepository } from "../drizzle-artwork-import.repository.js";
import { createDrizzleSaleAuthorityWriter } from "../drizzle-sale-authority.writer.js";
import { countSellableForArtwork } from "../shop-edition-availability.js";
import { resetAcceptanceCommerceState } from "./acceptance-commerce-seed.js";
import { SHOP_SEED_BUYER_FIXTURE_SLUG, seedShopFoundationCatalogue } from "./catalogue-seed.js";

describe.skipIf(!hasShopIntegrationDb)("acceptance commerce reset", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  const subjectId = "00000000-0000-4000-8000-000000000202";

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("clears buyer basket, pending checkout, and restores sellable harbor-print (idempotent)", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const grantSaleAuthority = authorityWriter.grantSaleAuthority.bind(authorityWriter);

    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      grantSaleAuthority,
    );

    const [harbor] = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.slug, SHOP_SEED_BUYER_FIXTURE_SLUG))
      .limit(1);
    expect(harbor?.id).toBeTruthy();

    const suffix = integrationSuffix("commerce-reset");
    const [basket] = await db
      .insert(shopBasket)
      .values({
        identitySubjectId: subjectId,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
      .returning({ id: shopBasket.id });

    await db.insert(shopBasketLine).values({
      basketId: basket!.id,
      artworkId: harbor!.id,
      unitPricePence: 8_500,
      quantity: 1,
    });

    await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId: harbor!.id,
      suffix,
      identitySubjectId: subjectId,
    });

    await resetAcceptanceCommerceState(db, { identitySubjectId: subjectId });
    await resetAcceptanceCommerceState(db, { identitySubjectId: subjectId });

    const openBaskets = await db
      .select({ id: shopBasket.id })
      .from(shopBasket)
      .where(and(eq(shopBasket.identitySubjectId, subjectId), isNull(shopBasket.retiredAt)));
    expect(openBaskets).toHaveLength(0);

    const pending = await db
      .select({ id: shopOrder.id })
      .from(shopOrder)
      .where(
        and(eq(shopOrder.identitySubjectId, subjectId), eq(shopOrder.status, "pending_payment")),
      );
    expect(pending).toHaveLength(0);

    const sellable = await countSellableForArtwork(db, harbor!.id);
    expect(sellable).toBeGreaterThanOrEqual(1);

    const authorised = await db
      .select({ id: shopEdition.id })
      .from(shopEdition)
      .where(
        and(eq(shopEdition.artworkId, harbor!.id), eq(shopEdition.listingStatus, "authorised")),
      );
    expect(authorised.length).toBeGreaterThanOrEqual(1);
  });
});
