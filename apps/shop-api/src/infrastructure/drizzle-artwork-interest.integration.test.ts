import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { domainEvent, shopArtworkInterest, shopEdition } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGetArtworkInterestHandler } from "../application/handlers/get-artwork-interest.handler.js";
import { createRegisterArtworkInterestHandler } from "../application/handlers/register-artwork-interest.handler.js";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";
import { createDrizzleArtworkInterestRepository } from "./drizzle-artwork-interest.repository.js";

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
    const writer = createDrizzleArtworkInterestRepository(db);
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
      .set({ status: "sold", ownerPartyId: null })
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
      idempotencyKey: `shop.artwork.interest_registered:${imported.artworkId}:${subject}:notify_me`,
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
      createDrizzleArtworkInterestRepository(db),
    );
    const suffix = Date.now();
    const slug = `integration-interest-purchasable-${suffix}`;

    await importWriter.importArtwork({
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

    await expect(
      registerInterest({
        artworkSlug: slug,
        identitySubjectId: `subject-${suffix}`,
        intent: "notify_me",
      }),
    ).resolves.toBe("not_subscribable");
  });

  it("returns not found for unknown artwork slug on read and write", async () => {
    const writer = createDrizzleArtworkInterestRepository(createDbFromPool(shopPool));
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
      createDrizzleArtworkInterestRepository(shopDb),
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
