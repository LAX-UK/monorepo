import {
  shopAdminAudit,
  shopArtwork,
  shopArtworkCategory,
  shopCategory,
  shopHomePlacement,
} from "@auction/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHomeFeaturesService } from "../../application/home-features/home-features.service.js";
import { HomeFeaturesRejectedError } from "../../errors/home-features-rejected-error.js";
import {
  createPublishedArtworkImportWriter,
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
  requireDefined,
} from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleHomeFeatureListReader } from "./drizzle-home-feature.reader.js";
import { createDrizzleHomeFeaturesUnitOfWork } from "./drizzle-home-features.unit-of-work.js";

const resolveMediaUrl = (value: string | null | undefined) => value ?? null;

describe.skipIf(!hasShopIntegrationDb)("Featured on home against the database", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  it("saves each list through the curation writer, with status facts and an audit entry", async () => {
    const db = createShopDb(shopPool);
    const service = createHomeFeaturesService({
      uow: createDrizzleHomeFeaturesUnitOfWork(createDrizzleShopUnitOfWork(db, "off"), {
        resolveMediaUrl,
      }),
      lists: createDrizzleHomeFeatureListReader(db, { resolveMediaUrl }),
      clock: { now: () => new Date() },
    });

    // A print on sale, a print with nothing on sale, and an original on lax.art.
    const onSale = await importTestArtwork(db, "foh-on-sale");
    await grantLaxSaleAuthority(db, onSale.artworkId, 1);
    const soldOut = await importTestArtwork(db, "foh-sold-out");
    const suffix = integrationSuffix("foh-original");
    const original = await createPublishedArtworkImportWriter(db, "off").importArtwork({
      importKey: `integration:foh-original:${suffix}`,
      slug: `foh-original-${suffix}`,
      title: "Original on lax.art",
      description: null,
      primaryImageUrl: "https://example.test/original.jpg",
      artistSlug: `foh-original-artist-${suffix}`,
      artistDisplayName: "Original Artist",
      eligibleForEditionAllocation: false,
      salesChannel: "art",
    });
    const artistOf = async (artworkId: string) => {
      const [row] = await db
        .select({ artistId: shopArtwork.artistId })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, artworkId));
      return requireDefined(row, "artwork").artistId;
    };
    const originalArtistId = await artistOf(original.artworkId);
    const onSaleArtistId = await artistOf(onSale.artworkId);
    const [category] = await db
      .insert(shopCategory)
      .values({ slug: `foh-category-${suffix}`, label: "Featured prints" })
      .returning({ id: shopCategory.id });
    const categoryId = requireDefined(category, "category").id;
    await db.insert(shopArtworkCategory).values({ artworkId: onSale.artworkId, categoryId });

    const actor = (key: string) => ({ actorSubjectId: "integration-staff", idempotencyKey: key });

    const prints = await service.replace({
      ...actor(crypto.randomUUID()),
      slot: "featured_prints",
      ids: [soldOut.artworkId, onSale.artworkId],
    });
    expect(prints.refreshesArt).toBe(false);
    expect(
      prints.features.featured_prints.map((row) => [row.id, row.live, row.soldOut, row.hasImage]),
    ).toEqual([
      [soldOut.artworkId, true, true, false],
      [onSale.artworkId, true, false, false],
    ]);

    const artists = await service.replace({
      ...actor(crypto.randomUUID()),
      slot: "featured_artists",
      ids: [originalArtistId, onSaleArtistId],
    });
    expect(artists.refreshesArt).toBe(true);
    expect(
      artists.features.featured_artists.map((row) => [row.id, row.onArt, row.hasEditionsOnSale]),
    ).toEqual([
      [originalArtistId, true, false],
      [onSaleArtistId, false, true],
    ]);

    const categories = await service.replace({
      ...actor(crypto.randomUUID()),
      slot: "featured_categories",
      ids: [categoryId],
    });
    expect(categories.features.featured_categories).toEqual([
      { id: categoryId, name: "Featured prints", editionCount: 1 },
    ]);

    // An original never goes among the prints, and a refused save changes nothing.
    await expect(
      service.replace({
        ...actor(crypto.randomUUID()),
        slot: "featured_prints",
        ids: [original.artworkId],
      }),
    ).rejects.toBeInstanceOf(HomeFeaturesRejectedError);
    const placed = await db
      .select({
        artworkId: shopHomePlacement.artworkId,
        publishedAt: shopHomePlacement.publishedAt,
      })
      .from(shopHomePlacement)
      .where(eq(shopHomePlacement.slot, "featured_prints"))
      .orderBy(asc(shopHomePlacement.position));
    expect(placed.map((row) => row.artworkId)).toEqual([soldOut.artworkId, onSale.artworkId]);
    expect(placed.every((row) => row.publishedAt !== null)).toBe(true);

    // Reordering is audited with the list before and after.
    await service.replace({
      ...actor(crypto.randomUUID()),
      slot: "featured_artists",
      ids: [onSaleArtistId],
    });
    const audits = await db
      .select({ beforeJson: shopAdminAudit.beforeJson, afterJson: shopAdminAudit.afterJson })
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.action, "home_features.replace"),
          eq(shopAdminAudit.targetId, "featured_artists"),
        ),
      )
      .orderBy(asc(shopAdminAudit.createdAt));
    const last = requireDefined(audits.at(-1), "audit entry");
    expect(JSON.parse(requireDefined(last.beforeJson, "before"))).toEqual({
      ids: [originalArtistId, onSaleArtistId],
    });
    expect(JSON.parse(requireDefined(last.afterJson, "after"))).toEqual({ ids: [onSaleArtistId] });

    // Candidates are Shop editions only.
    const candidates = await service.searchCandidates("featured_prints", {
      q: "foh-",
      limit: 15,
    });
    expect(candidates.map((row) => row.id)).not.toContain(original.artworkId);
  });
});
