import { createDbFromPool } from "@auction/db";
import { applyApplicationRoleGrants } from "@auction/db/migrate-roles";
import { shopFollowedArtist, shopSavedArtwork } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublishedArtworkImportWriter } from "../test-support/shop-fixtures.js";
import { createDrizzlePortalFavoritesRepository } from "./drizzle-portal-favorites.repository.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;

describe.skipIf(!ownerUrl || !shopUrl)("drizzle portal favorites repository", () => {
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

  async function importFixture(suffix: string) {
    const db = createDbFromPool(shopPool);
    const artworkSlug = `integration-favorite-work-${suffix}`;
    const artistSlug = `integration-favorite-artist-${suffix}`;
    const imported = await createPublishedArtworkImportWriter(db).importArtwork({
      importKey: `integration:favorites:${suffix}`,
      slug: artworkSlug,
      title: "Favorite Work",
      description: null,
      primaryImageUrl: null,
      artistSlug,
      artistDisplayName: "Favorite Artist",
      eligibleForEditionAllocation: false,
      printPricePence: null,
    });
    return { db, artworkSlug, artistSlug, artworkId: imported.artworkId };
  }

  it("saves and removes artworks idempotently, scoped to the subject", async () => {
    const suffix = `${Date.now()}-save`;
    const { db, artworkSlug, artistSlug } = await importFixture(suffix);
    const favorites = createDrizzlePortalFavoritesRepository(db);
    const subject = `integration-favorites-subject-${suffix}`;
    const otherSubject = `${subject}-other`;

    expect(await favorites.saveArtwork(subject, artworkSlug)).toBe("saved");
    expect(await favorites.saveArtwork(subject, artworkSlug)).toBe("already_saved");
    expect(await favorites.saveArtwork(subject, `${artworkSlug}-missing`)).toBe(
      "artwork_not_found",
    );

    const saved = await favorites.listSavedArtworks(subject);
    expect(saved).toEqual([
      expect.objectContaining({
        artworkSlug,
        artworkTitle: "Favorite Work",
        artistSlug,
        artistName: "Favorite Artist",
        salesChannel: "shop",
      }),
    ]);
    expect(await favorites.listSavedArtworks(otherSubject)).toEqual([]);
    expect(await favorites.unsaveArtwork(otherSubject, artworkSlug)).toBe("not_saved");

    expect(await favorites.unsaveArtwork(subject, artworkSlug)).toBe("removed");
    expect(await favorites.unsaveArtwork(subject, artworkSlug)).toBe("not_saved");
    expect(await favorites.listSavedArtworks(subject)).toEqual([]);
  });

  it("follows and unfollows artists idempotently", async () => {
    const suffix = `${Date.now()}-follow`;
    const { db, artistSlug } = await importFixture(suffix);
    const favorites = createDrizzlePortalFavoritesRepository(db);
    const subject = `integration-favorites-subject-${suffix}`;

    expect(await favorites.followArtist(subject, artistSlug)).toBe("followed");
    expect(await favorites.followArtist(subject, artistSlug)).toBe("already_followed");
    expect(await favorites.followArtist(subject, `${artistSlug}-missing`)).toBe("artist_not_found");
    expect(await favorites.listFollowedArtists(subject)).toEqual([
      expect.objectContaining({ artistSlug, artistName: "Favorite Artist" }),
    ]);

    expect(await favorites.unfollowArtist(subject, artistSlug)).toBe("removed");
    expect(await favorites.unfollowArtist(subject, artistSlug)).toBe("not_following");
    expect(await favorites.listFollowedArtists(subject)).toEqual([]);
  });

  it("cascades favorites when the artwork or artist is deleted", async () => {
    const suffix = `${Date.now()}-cascade`;
    const { db, artworkSlug, artistSlug, artworkId } = await importFixture(suffix);
    const favorites = createDrizzlePortalFavoritesRepository(db);
    const subject = `integration-favorites-subject-${suffix}`;

    await favorites.saveArtwork(subject, artworkSlug);
    await favorites.followArtist(subject, artistSlug);
    const [followRow] = await db
      .select({ artistId: shopFollowedArtist.artistId })
      .from(shopFollowedArtist)
      .where(eq(shopFollowedArtist.identitySubjectId, subject));
    if (!followRow) throw new Error("expected follow row");

    await ownerPool.query("DELETE FROM shop_artwork WHERE id = $1", [artworkId]);
    expect(
      await db
        .select()
        .from(shopSavedArtwork)
        .where(eq(shopSavedArtwork.identitySubjectId, subject)),
    ).toEqual([]);

    await ownerPool.query("DELETE FROM shop_artist WHERE id = $1", [followRow.artistId]);
    expect(
      await db
        .select()
        .from(shopFollowedArtist)
        .where(eq(shopFollowedArtist.identitySubjectId, subject)),
    ).toEqual([]);
  });
});
