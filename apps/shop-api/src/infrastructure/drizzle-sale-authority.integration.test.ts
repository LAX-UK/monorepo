import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { shopEdition, shopOrder } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import { createDrizzleSaleAuthorityWriter } from "./drizzle-sale-authority.writer.js";
import { reserveEditionsForCheckoutOrder } from "./shop-checkout-reservation.js";
import { createShopDomainEventPublisher } from "./shop-domain-event-publisher.js";
import { countSellableForArtwork } from "./shop-edition-availability.js";
import { resolveListingStatusAfterReservationRelease } from "./shop-edition-listing-on-release.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

function requireDefined<T>(value: T | null | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

describe.skipIf(!ownerUrl || !shopUrl)("sale authority and checkout pick order", () => {
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

  it("authorises LAX editions and increases sellable count", async () => {
    const db = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const suffix = Date.now();
    const imported = await importWriter.importArtwork({
      importKey: `integration:authority:${suffix}`,
      slug: `integration-authority-${suffix}`,
      title: "Authority test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-authority-artist-${suffix}`,
      artistDisplayName: "Authority Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });

    expect(await countSellableForArtwork(db, imported.artworkId)).toBe(0);

    const [laxEdition] = await db
      .select({ ownerPartyId: shopEdition.ownerPartyId })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, imported.artworkId), eq(shopEdition.allocation, "lax")))
      .limit(1);
    const ownerPartyId = requireDefined(laxEdition?.ownerPartyId, "lax owner party");

    const result = await authorityWriter.grantSaleAuthority({
      artworkId: imported.artworkId,
      ownerPartyId,
      authorisedCount: 2,
      evidenceNote: "integration test grant",
      recordedBySubjectId: "staff-subject-integration",
    });
    expect(result.editionNumbersAuthorised.length).toBe(2);
    expect(await countSellableForArtwork(db, imported.artworkId)).toBe(2);
  });

  it("blocks authority reduction below committed reserved editions", async () => {
    const db = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const suffix = Date.now();
    const imported = await importWriter.importArtwork({
      importKey: `integration:authority-reduce:${suffix}`,
      slug: `integration-authority-reduce-${suffix}`,
      title: "Authority reduce test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-authority-reduce-artist-${suffix}`,
      artistDisplayName: "Authority Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });

    const [laxEdition] = await db
      .select({ ownerPartyId: shopEdition.ownerPartyId, id: shopEdition.id })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, imported.artworkId), eq(shopEdition.allocation, "lax")))
      .orderBy(shopEdition.editionNumber)
      .limit(1);
    const ownerPartyId = requireDefined(laxEdition?.ownerPartyId, "lax owner party");

    await authorityWriter.grantSaleAuthority({
      artworkId: imported.artworkId,
      ownerPartyId,
      authorisedCount: 1,
      evidenceNote: "grant one",
      recordedBySubjectId: "staff-subject-integration",
    });

    await db
      .update(shopEdition)
      .set({
        listingStatus: "reserved",
        reservedUntil: new Date(Date.now() + 60_000),
        reservedByOrderId: null,
      })
      .where(eq(shopEdition.id, requireDefined(laxEdition?.id, "edition id")));

    const reduced = await authorityWriter.grantSaleAuthority({
      artworkId: imported.artworkId,
      ownerPartyId,
      authorisedCount: 0,
      evidenceNote: "revoke free only",
      recordedBySubjectId: "staff-subject-integration",
    });
    expect(reduced.editionNumbersRevoked.length).toBe(0);
    const [stillReserved] = await db
      .select({ listingStatus: shopEdition.listingStatus })
      .from(shopEdition)
      .where(eq(shopEdition.id, requireDefined(laxEdition?.id, "edition id")));
    expect(stillReserved?.listingStatus).toBe("reserved");

    await db.transaction(async (tx) => {
      const listingStatus = await resolveListingStatusAfterReservationRelease(tx, {
        artworkId: imported.artworkId,
        ownerPartyId,
      });
      expect(listingStatus).toBe("not_authorised");
      await tx
        .update(shopEdition)
        .set({
          listingStatus,
          reservedUntil: null,
          reservedByOrderId: null,
        })
        .where(eq(shopEdition.id, requireDefined(laxEdition?.id, "edition id")));
    });
    const [afterRelease] = await db
      .select({ listingStatus: shopEdition.listingStatus })
      .from(shopEdition)
      .where(eq(shopEdition.id, requireDefined(laxEdition?.id, "edition id")));
    expect(afterRelease?.listingStatus).toBe("not_authorised");
  });

  it("reserves lowest edition number first after grant", async () => {
    const db = createDbFromPool(shopPool);
    const events = createShopDomainEventPublisher("off");
    const importWriter = createDrizzleArtworkImportRepository(db, "off");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    const suffix = Date.now();
    const imported = await importWriter.importArtwork({
      importKey: `integration:authority-pick:${suffix}`,
      slug: `integration-authority-pick-${suffix}`,
      title: "Pick order test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-authority-pick-artist-${suffix}`,
      artistDisplayName: "Authority Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });

    const [laxEdition] = await db
      .select({ ownerPartyId: shopEdition.ownerPartyId })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, imported.artworkId), eq(shopEdition.allocation, "lax")))
      .limit(1);
    const ownerPartyId = requireDefined(laxEdition?.ownerPartyId, "lax owner party");

    await authorityWriter.grantSaleAuthority({
      artworkId: imported.artworkId,
      ownerPartyId,
      authorisedCount: 3,
      evidenceNote: "pick order grant",
      recordedBySubjectId: "staff-subject-integration",
    });

    const [orderRow] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-pick-${suffix}`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: 5_000,
        fulfilmentSurchargePence: 0,
        totalPence: 5_000,
        idempotencyKey: `idem-pick-${suffix}`,
        status: "pending_payment",
      })
      .returning({ id: shopOrder.id });
    const orderId = requireDefined(orderRow?.id, "order id");
    await db.transaction(async (tx) => {
      await reserveEditionsForCheckoutOrder(
        tx as ReturnType<typeof createDbFromPool>,
        {
          orderId,
          reservedUntil: new Date(Date.now() + 60_000),
          expandedLines: [{ artworkId: imported.artworkId, unitPricePence: 5_000 }],
        },
        events,
      );
    });

    const [reserved] = await db
      .select({ editionNumber: shopEdition.editionNumber })
      .from(shopEdition)
      .where(
        and(
          eq(shopEdition.artworkId, imported.artworkId),
          eq(shopEdition.listingStatus, "reserved"),
        ),
      )
      .limit(1);
    const laxNumbers = await db
      .select({ editionNumber: shopEdition.editionNumber })
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, imported.artworkId), eq(shopEdition.allocation, "lax")))
      .orderBy(shopEdition.editionNumber);
    const minLax = Math.min(...laxNumbers.map((row) => row.editionNumber));
    expect(reserved?.editionNumber).toBe(minLax);
  });
});
