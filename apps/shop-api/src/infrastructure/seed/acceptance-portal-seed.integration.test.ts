import {
  shopArtwork,
  shopArtworkInterest,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopSaleAuthorityGrant,
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
import {
  SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG,
  resetAcceptanceEnquiryInterestFixture,
  resetAcceptanceStripeCheckoutFixture,
} from "./acceptance-commerce-seed.js";
import {
  SHOP_ACCEPTANCE_OWNED_ARTWORK_SLUG,
  seedAcceptancePortalFixtures,
} from "./acceptance-portal-seed.js";
import { SHOP_SEED_STRIPE_CHECKOUT_SLUG, seedShopFoundationCatalogue } from "./catalogue-seed.js";

describe.skipIf(!hasShopIntegrationDb)("acceptance portal seed", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  const subjectId = "00000000-0000-4000-8000-000000000101";

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  it("is idempotent and grants populated portal fixtures", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const grantSaleAuthority = authorityWriter.grantSaleAuthority.bind(authorityWriter);

    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      grantSaleAuthority,
    );
    await resetAcceptanceStripeCheckoutFixture(db);

    await seedAcceptancePortalFixtures(db, grantSaleAuthority, {
      identitySubjectId: subjectId,
    });
    await seedAcceptancePortalFixtures(db, grantSaleAuthority, {
      identitySubjectId: subjectId,
    });

    const owned = await db
      .select({ listingStatus: shopEdition.listingStatus })
      .from(shopEdition)
      .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
      .where(eq(shopArtwork.slug, SHOP_ACCEPTANCE_OWNED_ARTWORK_SLUG));

    expect(owned.some((row) => row.listingStatus === "sold")).toBe(true);
    expect(owned.some((row) => row.listingStatus === "authorised")).toBe(true);

    const grants = await db.select({ id: shopSaleAuthorityGrant.id }).from(shopSaleAuthorityGrant);
    expect(grants.length).toBeGreaterThan(0);

    const stripeEditions = await db
      .select({ listingStatus: shopEdition.listingStatus })
      .from(shopEdition)
      .innerJoin(shopArtwork, eq(shopEdition.artworkId, shopArtwork.id))
      .where(eq(shopArtwork.slug, SHOP_SEED_STRIPE_CHECKOUT_SLUG));
    expect(stripeEditions.every((row) => row.listingStatus === "authorised")).toBe(true);
  });

  it("clears stale Stripe checkout reservations idempotently", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      authorityWriter.grantSaleAuthority.bind(authorityWriter),
    );

    const artworkRows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.slug, SHOP_SEED_STRIPE_CHECKOUT_SLUG))
      .limit(1);
    const artworkId = artworkRows[0]?.id;
    if (!artworkId) {
      throw new Error("acceptance-stripe-print missing after catalogue seed");
    }

    const suffix = integrationSuffix("stripe-reset");
    const pending = await createPendingPaymentOrderWithReservedEdition(db, {
      artworkId,
      suffix,
    });

    await resetAcceptanceStripeCheckoutFixture(db);
    await resetAcceptanceStripeCheckoutFixture(db);

    const [order] = await db
      .select({ status: shopOrder.status })
      .from(shopOrder)
      .where(eq(shopOrder.id, pending.orderId))
      .limit(1);
    expect(order?.status).toBe("expired");

    const activeLines = await db
      .select({ id: shopOrderLine.id })
      .from(shopOrderLine)
      .where(and(eq(shopOrderLine.orderId, pending.orderId), isNull(shopOrderLine.releasedAt)));
    expect(activeLines).toHaveLength(0);

    const stripeEditions = await db
      .select({ listingStatus: shopEdition.listingStatus })
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, artworkId));
    expect(stripeEditions.every((row) => row.listingStatus === "authorised")).toBe(true);
  });

  it("resets acceptance enquiry interest for string-study idempotently", async () => {
    const db = createShopDb(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    await seedShopFoundationCatalogue(
      importWriter.importArtwork.bind(importWriter),
      db,
      authorityWriter.grantSaleAuthority.bind(authorityWriter),
    );

    const artworkRows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.slug, SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG))
      .limit(1);
    const artworkId = artworkRows[0]?.id;
    if (!artworkId) {
      throw new Error("string-study missing after catalogue seed");
    }

    await db.insert(shopArtworkInterest).values({
      artworkId,
      identitySubjectId: subjectId,
      intent: "enquiry",
    });

    await resetAcceptanceEnquiryInterestFixture(db, subjectId);
    await resetAcceptanceEnquiryInterestFixture(db, subjectId);

    const remaining = await db
      .select({ id: shopArtworkInterest.id })
      .from(shopArtworkInterest)
      .where(eq(shopArtworkInterest.identitySubjectId, subjectId));
    expect(remaining).toHaveLength(0);
  });
});
