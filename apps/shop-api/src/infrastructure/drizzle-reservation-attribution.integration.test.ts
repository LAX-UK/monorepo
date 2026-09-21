import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { shopEdition, shopOrder, shopOrderLine } from "@auction/db/schema";
import { LAX_ALLOCATION_COUNT } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import {
  completeShopCheckoutSession,
  expireShopCheckoutSession,
} from "./drizzle-payment-event.processor.js";
import { countSellableForArtwork } from "./shop-edition-availability.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

function requireDefined<T>(value: T | null | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

/** Sellable stock lives on LAX-owned editions (10/10/4 plan), not edition #1. */
async function selectLaxEdition(db: ReturnType<typeof createDbFromPool>, artworkId: string) {
  const [edition] = await db
    .select()
    .from(shopEdition)
    .where(and(eq(shopEdition.artworkId, artworkId), eq(shopEdition.allocation, "lax")))
    .limit(1);
  return requireDefined(edition, "lax edition");
}

describe.skipIf(!ownerUrl || !shopUrl)("edition reservation attribution", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    if (!ownerUrl || !shopUrl) throw new Error("Integration test database URLs are required");
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("does not treat an edition as sellable while a pending_payment order still holds the reservation", async () => {
    const db = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db);
    const suffix = Date.now();
    const imported = await importWriter.importArtwork({
      importKey: `integration:attrib:${suffix}`,
      slug: `integration-attrib-${suffix}`,
      title: "Attribution test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-attrib-artist-${suffix}`,
      artistDisplayName: "Attrib Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });
    const reservedEdition = await selectLaxEdition(db, imported.artworkId);
    expect(await countSellableForArtwork(db, imported.artworkId)).toBe(LAX_ALLOCATION_COUNT);

    const past = new Date(Date.now() - 60_000);
    const [orderRow] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-a-${suffix}`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: 5_000,
        fulfilmentSurchargePence: 0,
        totalPence: 5_000,
        idempotencyKey: `idem-a-${suffix}`,
        status: "pending_payment",
      })
      .returning();
    const orderA = requireDefined(orderRow, "order");
    await db
      .update(shopEdition)
      .set({
        status: "reserved",
        reservedUntil: past,
        reservedByOrderId: orderA.id,
      })
      .where(eq(shopEdition.id, reservedEdition.id));

    const sellable = await countSellableForArtwork(db, imported.artworkId);
    expect(sellable).toBe(LAX_ALLOCATION_COUNT - 1);
  });

  it("rejects completion when the edition is reserved for a different order", async () => {
    const db = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db);
    const suffix = Date.now();
    const imported = await importWriter.importArtwork({
      importKey: `integration:attrib-complete:${suffix}`,
      slug: `integration-attrib-complete-${suffix}`,
      title: "Complete attribution test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-attrib-artist-c-${suffix}`,
      artistDisplayName: "Attrib Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });
    const edition = await selectLaxEdition(db, imported.artworkId);
    const ownerPartyId = requireDefined(edition.ownerPartyId, "owner party");
    const reservedEdition = { ...edition, ownerPartyId };

    const insertedOrders = await db
      .insert(shopOrder)
      .values([
        {
          identitySubjectId: `subject-a-c-${suffix}`,
          fulfilment: "collect_brunswick",
          merchandiseSubtotalPence: 5_000,
          fulfilmentSurchargePence: 0,
          totalPence: 5_000,
          idempotencyKey: `idem-a-c-${suffix}`,
          status: "pending_payment",
        },
        {
          identitySubjectId: `subject-b-c-${suffix}`,
          fulfilment: "collect_brunswick",
          merchandiseSubtotalPence: 5_000,
          fulfilmentSurchargePence: 0,
          totalPence: 5_000,
          idempotencyKey: `idem-b-c-${suffix}`,
          status: "pending_payment",
        },
      ])
      .returning();
    const orderA = requireDefined(insertedOrders[0], "order A");
    const orderB = requireDefined(insertedOrders[1], "order B");

    await db.insert(shopOrderLine).values([
      {
        orderId: requireDefined(orderA.id, "order A id"),
        editionId: requireDefined(reservedEdition.id, "edition id"),
        artworkId: imported.artworkId,
        sellerPartyId: ownerPartyId,
        editionNumber: reservedEdition.editionNumber,
        unitPricePence: 5_000,
      },
      {
        orderId: requireDefined(orderB.id, "order B id"),
        editionId: requireDefined(reservedEdition.id, "edition id"),
        artworkId: imported.artworkId,
        sellerPartyId: ownerPartyId,
        editionNumber: reservedEdition.editionNumber,
        unitPricePence: 5_000,
      },
    ]);

    await db
      .update(shopEdition)
      .set({
        status: "reserved",
        reservedUntil: new Date(Date.now() + 60_000),
        reservedByOrderId: orderB.id,
      })
      .where(eq(shopEdition.id, reservedEdition.id));

    await expect(
      completeShopCheckoutSession(db, {
        eventId: `evt-a-${suffix}`,
        orderId: orderA.id,
        amountTotalPence: 5_000,
        paidAt: new Date(),
      }),
    ).rejects.toMatchObject({
      message: "edition_state_invalid",
      retryable: false,
    });
  });

  it("does not release an edition on expire when reserved for another order", async () => {
    const db = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db);
    const suffix = Date.now();
    const imported = await importWriter.importArtwork({
      importKey: `integration:attrib-expire:${suffix}`,
      slug: `integration-attrib-expire-${suffix}`,
      title: "Expire attribution test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-attrib-artist-e-${suffix}`,
      artistDisplayName: "Attrib Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });
    const editionRow = await selectLaxEdition(db, imported.artworkId);
    const ownerPartyId = requireDefined(editionRow.ownerPartyId, "owner party");
    const reservedEdition = { ...editionRow, ownerPartyId };

    const insertedOrders = await db
      .insert(shopOrder)
      .values([
        {
          identitySubjectId: `subject-a-e-${suffix}`,
          fulfilment: "collect_brunswick",
          merchandiseSubtotalPence: 5_000,
          fulfilmentSurchargePence: 0,
          totalPence: 5_000,
          idempotencyKey: `idem-a-e-${suffix}`,
          status: "pending_payment",
        },
        {
          identitySubjectId: `subject-b-e-${suffix}`,
          fulfilment: "collect_brunswick",
          merchandiseSubtotalPence: 5_000,
          fulfilmentSurchargePence: 0,
          totalPence: 5_000,
          idempotencyKey: `idem-b-e-${suffix}`,
          status: "pending_payment",
        },
      ])
      .returning();
    const orderA = requireDefined(insertedOrders[0], "order A");
    const orderB = requireDefined(insertedOrders[1], "order B");

    await db.insert(shopOrderLine).values({
      orderId: requireDefined(orderA.id, "order A id"),
      editionId: requireDefined(reservedEdition.id, "edition id"),
      artworkId: imported.artworkId,
      sellerPartyId: ownerPartyId,
      editionNumber: reservedEdition.editionNumber,
      unitPricePence: 5_000,
    });

    await db
      .update(shopEdition)
      .set({
        status: "reserved",
        reservedUntil: new Date(Date.now() + 60_000),
        reservedByOrderId: orderB.id,
      })
      .where(eq(shopEdition.id, reservedEdition.id));

    await expireShopCheckoutSession(db, {
      eventId: `evt-exp-a-${suffix}`,
      orderId: orderA.id,
    });

    const [after] = await db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.id, reservedEdition.id));
    expect(after?.status).toBe("reserved");
    expect(after?.reservedByOrderId).toBe(orderB.id);
  });
});
