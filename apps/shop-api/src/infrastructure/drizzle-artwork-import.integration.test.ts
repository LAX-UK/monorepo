import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { domainEvent, shopArtist, shopArtwork, shopEdition, shopParty } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDrizzleArtworkImportRepository } from "./drizzle-artwork-import.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

describe.skipIf(!ownerUrl || !shopUrl)("drizzle artwork import", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ownerPool = new pg.Pool({ connectionString: ownerUrl });
    shopPool = new pg.Pool({ connectionString: shopUrl });
    if (!ownerUrl) throw new Error("MIGRATION_TEST_DATABASE_URL is required");
    await applyApplicationRoleGrants(ownerUrl);
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("allocates 24 editions and outbox events idempotently", async () => {
    const suffix = Date.now();
    const importKey = `integration:${suffix}:eligible`;
    const slug = `integration-eligible-${suffix}`;
    const artistSlug = `integration-artist-${suffix}`;
    const db = createDbFromPool(shopPool);
    const writer = createDrizzleArtworkImportRepository(db);

    const first = await writer.importArtwork({
      importKey,
      slug,
      title: "Integration Eligible",
      description: null,
      primaryImageUrl: null,
      artistSlug,
      artistDisplayName: "Integration Artist",
      eligibleForEditionAllocation: true,
    });
    expect(first.created).toBe(true);
    expect(first.editionCount).toBe(24);

    const second = await writer.importArtwork({
      importKey,
      slug,
      title: "Integration Eligible Duplicate",
      description: null,
      primaryImageUrl: null,
      artistSlug,
      artistDisplayName: "Integration Artist",
      eligibleForEditionAllocation: true,
    });
    expect(second.created).toBe(false);
    expect(second.editionCount).toBe(24);

    await expect(
      writer.importArtwork({
        importKey,
        slug,
        title: "Invalid eligibility change",
        description: null,
        primaryImageUrl: null,
        artistSlug,
        artistDisplayName: "Integration Artist",
        eligibleForEditionAllocation: false,
      }),
    ).rejects.toThrow(/eligibility is immutable/);

    const editions = await db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, first.artworkId));
    expect(editions).toHaveLength(24);
    const laxOwned = editions.filter((row) => row.allocation === "lax");
    const other = editions.filter((row) => row.allocation !== "lax");
    expect(laxOwned).toHaveLength(4);
    expect(laxOwned.every((row) => row.ownerPartyId !== null && row.status === "available")).toBe(
      true,
    );
    expect(other.every((row) => row.ownerPartyId === null)).toBe(true);

    const events = await db
      .select({ eventType: domainEvent.eventType })
      .from(domainEvent)
      .where(eq(domainEvent.aggregateId, first.artworkId));
    expect(events.map((row) => row.eventType).sort()).toEqual([
      "shop.artwork.created",
      "shop.editions.allocated",
    ]);
  });

  it("creates zero editions for ineligible artwork", async () => {
    const db = createDbFromPool(shopPool);
    const writer = createDrizzleArtworkImportRepository(db);
    const importKey = `integration:${Date.now()}:ineligible`;
    const result = await writer.importArtwork({
      importKey,
      slug: `integration-ineligible-${Date.now()}`,
      title: "Integration Ineligible",
      description: "No editions",
      primaryImageUrl: null,
      artistSlug: `integration-artist-ineligible-${Date.now()}`,
      artistDisplayName: "Integration Artist",
      eligibleForEditionAllocation: false,
    });
    expect(result.editionCount).toBe(0);
    const editions = await db
      .select()
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, result.artworkId));
    expect(editions).toHaveLength(0);
    const [artwork] = await db
      .select()
      .from(shopArtwork)
      .where(eq(shopArtwork.id, result.artworkId));
    expect(artwork?.eligibleForEditionAllocation).toBe(false);
  });

  it("refreshes artist metadata when a new artwork reuses an artist slug", async () => {
    const db = createDbFromPool(shopPool);
    const writer = createDrizzleArtworkImportRepository(db);
    const suffix = Date.now();
    const artistSlug = `integration-shared-artist-${suffix}`;
    await writer.importArtwork({
      importKey: `integration:${suffix}:artist-first`,
      slug: `integration-artist-first-${suffix}`,
      title: "First artist work",
      description: null,
      primaryImageUrl: null,
      artistSlug,
      artistDisplayName: "Old Display Name",
      eligibleForEditionAllocation: false,
    });
    await writer.importArtwork({
      importKey: `integration:${suffix}:artist-second`,
      slug: `integration-artist-second-${suffix}`,
      title: "Second artist work",
      description: null,
      primaryImageUrl: null,
      artistSlug,
      artistDisplayName: "Current Display Name",
      artistDiscipline: "Sculpture",
      eligibleForEditionAllocation: false,
    });

    const [artist] = await db
      .select({
        displayName: shopParty.displayName,
        discipline: shopArtist.discipline,
      })
      .from(shopArtist)
      .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
      .where(eq(shopArtist.slug, artistSlug));

    expect(artist).toEqual({
      displayName: "Current Display Name",
      discipline: "Sculpture",
    });
  });

  it("rejects duplicate artwork slugs and immutable slug changes", async () => {
    const db = createDbFromPool(shopPool);
    const writer = createDrizzleArtworkImportRepository(db);
    const suffix = Date.now();
    const slug = `integration-unique-slug-${suffix}`;
    const base = {
      title: "Slug policy",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-slug-artist-${suffix}`,
      artistDisplayName: "Slug Artist",
      eligibleForEditionAllocation: false,
    };

    await writer.importArtwork({
      ...base,
      importKey: `integration:${suffix}:slug-first`,
      slug,
    });
    await expect(
      writer.importArtwork({
        ...base,
        importKey: `integration:${suffix}:slug-second`,
        slug,
      }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
    await expect(
      writer.importArtwork({
        ...base,
        importKey: `integration:${suffix}:slug-first`,
        slug: `${slug}-changed`,
      }),
    ).rejects.toThrow(/slug is immutable/);
  });

  it("serializes concurrent creation for the same import key", async () => {
    const db = createDbFromPool(shopPool);
    const writer = createDrizzleArtworkImportRepository(db);
    const suffix = Date.now();
    const command = {
      importKey: `integration:${suffix}:concurrent`,
      slug: `integration-concurrent-${suffix}`,
      title: "Concurrent import",
      description: null,
      primaryImageUrl: null,
      artistSlug: `integration-concurrent-artist-${suffix}`,
      artistDisplayName: "Concurrent Artist",
      eligibleForEditionAllocation: true,
    };

    const results = await Promise.all([
      writer.importArtwork(command),
      writer.importArtwork(command),
    ]);

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.filter((result) => !result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.artworkId)).size).toBe(1);
    expect(results.every((result) => result.editionCount === 24)).toBe(true);
  });
});
