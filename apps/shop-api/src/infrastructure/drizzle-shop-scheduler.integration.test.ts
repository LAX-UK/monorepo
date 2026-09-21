import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import {
  emailOutbox,
  shopArtworkInterest,
  shopEdition,
  shopOrder,
  shopOrderLine,
  shopUserProfile,
} from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import { expireShopCheckoutSession } from "./drizzle-payment-event.processor.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
import { reapStaleShopCheckouts, reaperEventIdForOrder } from "./shop-checkout-reaper.js";
import { countSellableForArtwork } from "./shop-edition-availability.js";
import { dispatchShopNotifyMeEmails } from "./shop-notify-me-dispatch.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

function requireDefined<T>(value: T | null | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

describe.skipIf(!ownerUrl || !shopUrl)("shop scheduler integration", () => {
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

  it("reaper expires stale pending_payment orders and a later Stripe expiry is a no-op", async () => {
    const db = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db);
    const suffix = Date.now();
    const imported = await importWriter.importArtwork({
      importKey: `integration:reaper:${suffix}`,
      slug: `integration-reaper-${suffix}`,
      title: "Reaper test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-reaper-artist-${suffix}`,
      artistDisplayName: "Reaper Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });
    const [edition] = await db
      .select()
      .from(shopEdition)
      .where(and(eq(shopEdition.artworkId, imported.artworkId), eq(shopEdition.allocation, "lax")))
      .limit(1);
    const reservedEdition = requireDefined(edition, "lax edition");
    const ownerPartyId = requireDefined(reservedEdition.ownerPartyId, "owner party");

    const pastExpiry = new Date(Date.now() - 60_000);
    const [orderRow] = await db
      .insert(shopOrder)
      .values({
        identitySubjectId: `subject-reaper-${suffix}`,
        fulfilment: "collect_brunswick",
        merchandiseSubtotalPence: 5_000,
        fulfilmentSurchargePence: 0,
        totalPence: 5_000,
        idempotencyKey: `idem-reaper-${suffix}`,
        status: "pending_payment",
        checkoutExpiresAt: pastExpiry,
      })
      .returning();
    const order = requireDefined(orderRow, "order");

    await db.insert(shopOrderLine).values({
      orderId: requireDefined(order.id, "order id"),
      editionId: requireDefined(reservedEdition.id, "edition id"),
      artworkId: requireDefined(imported.artworkId, "artwork id"),
      sellerPartyId: ownerPartyId,
      editionNumber: reservedEdition.editionNumber,
      unitPricePence: 5_000,
    });
    await db
      .update(shopEdition)
      .set({
        status: "reserved",
        reservedUntil: pastExpiry,
        reservedByOrderId: order.id,
      })
      .where(eq(shopEdition.id, reservedEdition.id));

    await reapStaleShopCheckouts(db, new Date());

    const [orderAfter] = await db.select().from(shopOrder).where(eq(shopOrder.id, order.id));
    expect(orderAfter?.status).toBe("expired");
    expect(await countSellableForArtwork(db, imported.artworkId)).toBeGreaterThan(0);

    await expireShopCheckoutSession(db, {
      eventId: `evt-stripe-late-${suffix}`,
      orderId: order.id,
    });

    const [orderStill] = await db.select().from(shopOrder).where(eq(shopOrder.id, order.id));
    expect(orderStill?.status).toBe("expired");
    expect(reaperEventIdForOrder(order.id)).toContain(order.id);
  });

  it("notify-me dispatch stamps notified_at once and enqueues email outbox", async () => {
    const db = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db);
    const notifications = createDrizzleShopNotificationPublisher();
    const suffix = Date.now();
    const subjectId = `subject-notify-${suffix}`;
    await db.insert(shopUserProfile).values({
      identitySubjectId: subjectId,
      email: `notify-${suffix}@example.com`,
      name: "Notify Me",
    });

    const imported = await importWriter.importArtwork({
      importKey: `integration:notify:${suffix}`,
      slug: `integration-notify-${suffix}`,
      title: "Notify test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-notify-artist-${suffix}`,
      artistDisplayName: "Notify Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });

    const [interest] = await db
      .insert(shopArtworkInterest)
      .values({
        artworkId: imported.artworkId,
        identitySubjectId: subjectId,
        intent: "notify_me",
      })
      .returning();
    const interestRow = requireDefined(interest, "interest");

    const now = new Date();
    await dispatchShopNotifyMeEmails(db, {
      notifications,
      storefrontUrl: "http://localhost:3020",
      now,
    });
    await dispatchShopNotifyMeEmails(db, {
      notifications,
      storefrontUrl: "http://localhost:3020",
      now,
    });

    const [after] = await db
      .select()
      .from(shopArtworkInterest)
      .where(eq(shopArtworkInterest.id, interestRow.id));
    expect(after?.notifiedAt).not.toBeNull();

    const outbox = await db
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `edition-available:${interestRow.id}`));
    expect(outbox).toHaveLength(1);
  });
});
