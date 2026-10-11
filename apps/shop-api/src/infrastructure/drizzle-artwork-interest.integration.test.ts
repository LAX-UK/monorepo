import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { domainEvent, shopArtwork, shopArtworkInterest, shopEdition } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createGetArtworkInterestHandler } from "../application/handlers/get-artwork-interest.handler.js";
import { createRegisterArtworkInterestHandler } from "../application/handlers/register-artwork-interest.handler.js";
import type { ShopNotificationPublisher } from "../application/ports/shop-notification.publisher.js";
import { selectLaxEdition } from "../test-support/shop-fixtures.js";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import { createDrizzleArtworkInterestRepository } from "./drizzle-artwork-interest.repository.js";
import { createDrizzlePortalOwnershipRepository } from "./drizzle-portal-ownership.repository.js";
import { createDrizzleSaleAuthorityWriter } from "./drizzle-sale-authority.writer.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

describe.skipIf(!ownerUrl || !shopUrl)("drizzle artwork interest repository", () => {
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

  it("registers interest only for unavailable online artworks with one row and one event", async () => {
    const db = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db);
    const writer = createDrizzleArtworkInterestRepository(db, {
      storefrontOrigins: { shop: "http://localhost:3020", art: "http://localhost:3050" },
    });
    const registerInterest = createRegisterArtworkInterestHandler(writer);
    const suffix = Date.now();
    const slug = `integration-interest-sold-out-${suffix}`;
    const subject = `integration-subject-${suffix}`;

    const imported = await importWriter.importArtwork({
      importKey: `integration:interest:${suffix}`,
      slug,
      title: "Sold out interest test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-interest-artist-${suffix}`,
      artistDisplayName: "Interest Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 5_000,
    });
    await db
      .update(shopEdition)
      .set({ listingStatus: "sold", ownerPartyId: null })
      .where(eq(shopEdition.artworkId, imported.artworkId));

    const first = await registerInterest({
      artworkSlug: slug,
      identitySubjectId: subject,
      intent: "notify_me",
    });
    expect(first).toBe("registered");

    const second = await registerInterest({
      artworkSlug: slug,
      identitySubjectId: subject,
      intent: "notify_me",
    });
    expect(second).toBe("already_subscribed");

    const interests = await db
      .select()
      .from(shopArtworkInterest)
      .where(eq(shopArtworkInterest.artworkId, imported.artworkId));
    expect(interests).toHaveLength(1);

    const events = await db
      .select()
      .from(domainEvent)
      .where(eq(domainEvent.aggregateId, imported.artworkId));
    const interestEvents = events.filter((e) => e.eventType === "shop.artwork.interest_registered");
    expect(interestEvents).toHaveLength(1);
    expect(interestEvents[0]?.payload).toMatchObject({
      artworkId: imported.artworkId,
      identitySubjectId: subject,
      intent: "notify_me",
    });

    const getInterestStatus = createGetArtworkInterestHandler(writer);
    const status = await getInterestStatus({
      artworkSlug: slug,
      identitySubjectId: subject,
      intent: "notify_me",
    });
    expect(status).toEqual({ subscribed: true });
  });

  it("rejects interest registration when editions are purchasable online", async () => {
    const db = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(db);
    const registerInterest = createRegisterArtworkInterestHandler(
      createDrizzleArtworkInterestRepository(db, {
        storefrontOrigins: { shop: "http://localhost:3020", art: "http://localhost:3050" },
      }),
    );
    const suffix = Date.now();
    const slug = `integration-interest-purchasable-${suffix}`;

    const imported = await importWriter.importArtwork({
      importKey: `integration:interest:purchasable:${suffix}`,
      slug,
      title: "Purchasable interest test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-interest-artist-p-${suffix}`,
      artistDisplayName: "Interest Artist",
      eligibleForEditionAllocation: true,
      printPricePence: 8_000,
    });
    const laxEdition = await selectLaxEdition(db, imported.artworkId);
    const ownerPartyId = laxEdition.ownerPartyId;
    if (!ownerPartyId) throw new Error("Missing LAX owner party");
    const authorityWriter = createDrizzleSaleAuthorityWriter(db, "off");
    await authorityWriter.grantSaleAuthority({
      artworkId: imported.artworkId,
      ownerPartyId,
      authorisedCount: 4,
      evidenceNote: "interest purchasable fixture",
      recordedBySubjectId: "integration-staff",
    });

    await expect(
      registerInterest({
        artworkSlug: slug,
        identitySubjectId: `subject-${suffix}`,
        intent: "notify_me",
      }),
    ).resolves.toBe("not_subscribable");
  });

  it("stores enquiry message and phone, lists them, and links the ops alert to lax.art", async () => {
    const db = createDbFromPool(shopPool);
    const suffix = Date.now();
    const slug = `integration-enquiry-art-${suffix}`;
    const subject = `integration-enquiry-subject-${suffix}`;
    const imported = await createDrizzleArtworkImportRepository(db).importArtwork({
      importKey: `integration:enquiry:art:${suffix}`,
      slug,
      title: "Art enquiry original",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-enquiry-artist-${suffix}`,
      artistDisplayName: "Enquiry Artist",
      eligibleForEditionAllocation: false,
      printPricePence: null,
      saleState: "price_on_application",
    });
    await db
      .update(shopArtwork)
      .set({ salesChannel: "art" })
      .where(eq(shopArtwork.id, imported.artworkId));

    const queueEnquiryAlert = vi.fn(async () => undefined);
    const registerInterest = createRegisterArtworkInterestHandler(
      createDrizzleArtworkInterestRepository(db, {
        notifications: { queueEnquiryAlert } as unknown as ShopNotificationPublisher,
        enquiryOpsEmail: "ops@example.test",
        storefrontOrigins: { shop: "https://shop.example", art: "https://lax.art" },
      }),
    );

    await expect(
      registerInterest({
        artworkSlug: slug,
        identitySubjectId: subject,
        intent: "enquiry",
        message: "Could I view this in person?",
        contactPhone: "+44 20 7946 0000",
      }),
    ).resolves.toBe("registered");

    expect(queueEnquiryAlert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        artworkUrl: `https://lax.art/artworks/${slug}`,
        message: "Could I view this in person?",
        contactPhone: "+44 20 7946 0000",
      }),
    );

    const enquiries = await createDrizzlePortalOwnershipRepository(db).listEnquiries(subject);
    expect(enquiries).toEqual([
      expect.objectContaining({
        artworkSlug: slug,
        salesChannel: "art",
        intent: "enquiry",
        status: "open",
        message: "Could I view this in person?",
        contactPhone: "+44 20 7946 0000",
      }),
    ]);
  });

  it("returns not found for unknown artwork slug on read and write", async () => {
    const writer = createDrizzleArtworkInterestRepository(createDbFromPool(shopPool), {
      storefrontOrigins: { shop: "http://localhost:3020", art: "http://localhost:3050" },
    });
    const getInterestStatus = createGetArtworkInterestHandler(writer);
    const registerInterest = createRegisterArtworkInterestHandler(writer);
    const slug = `missing-artwork-${Date.now()}`;
    await expect(
      getInterestStatus({ artworkSlug: slug, identitySubjectId: "subject", intent: "notify_me" }),
    ).resolves.toBe("artwork_not_found");
    await expect(
      registerInterest({ artworkSlug: slug, identitySubjectId: "subject", intent: "notify_me" }),
    ).resolves.toBe("artwork_not_found");
  });

  it("allows shop_app role to insert interest rows", async () => {
    const shopDb = createDbFromPool(shopPool);
    const importWriter = createDrizzleArtworkImportRepository(shopDb);
    const registerInterest = createRegisterArtworkInterestHandler(
      createDrizzleArtworkInterestRepository(shopDb, {
        storefrontOrigins: { shop: "http://localhost:3020", art: "http://localhost:3050" },
      }),
    );
    const suffix = Date.now();
    const slug = `integration-interest-grants-${suffix}`;
    await importWriter.importArtwork({
      importKey: `integration:interest:grants:${suffix}`,
      slug,
      title: "Grants test",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-grants-artist-${suffix}`,
      artistDisplayName: "Grants Artist",
      eligibleForEditionAllocation: true,
      printPricePence: null,
    });

    await expect(
      registerInterest({
        artworkSlug: slug,
        identitySubjectId: `grants-subject-${suffix}`,
        intent: "notify_me",
      }),
    ).resolves.toBe("registered");
  });
});
