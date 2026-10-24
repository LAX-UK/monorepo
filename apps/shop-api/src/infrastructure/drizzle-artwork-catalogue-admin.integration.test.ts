import { shopAdminAudit, shopMediaAsset } from "@auction/db/schema";
import { ShopDomainError } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShopApiError } from "../errors/shop-api-error.js";
import { StaleVersionError } from "../errors/stale-version-error.js";
import { integrationSuffix, requireDefined } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleAdminArtworkReader } from "./drizzle-admin-artwork.reader.js";
import { createDrizzleArtistCatalogueWriter } from "./drizzle-artist-catalogue.writer.js";
import { createDrizzleArtworkCatalogueRepository } from "./drizzle-artwork-catalogue.repository.js";
import { createDrizzleArtworkCatalogueWriter } from "./drizzle-artwork-catalogue.writer.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";

const ACTOR = "artwork-catalogue-it-staff";
const key = () => `idem-${integrationSuffix("a")}`;
const resolveMediaUrl = (value: string | null | undefined) => (value ? `/${value}` : null);

describe.skipIf(!hasShopIntegrationDb)("artwork catalogue administration", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup() {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    return {
      db,
      writer: createDrizzleArtworkCatalogueWriter(uow, { resolveMediaUrl }),
      artists: createDrizzleArtistCatalogueWriter(uow),
      reader: createDrizzleAdminArtworkReader(db, { resolveMediaUrl }),
      storefront: createDrizzleArtworkCatalogueRepository(db, { resolveMediaUrl }),
      auditActions: async (targetId: string) =>
        (
          await db
            .select({ action: shopAdminAudit.action })
            .from(shopAdminAudit)
            .where(eq(shopAdminAudit.targetId, targetId))
            .orderBy(shopAdminAudit.createdAt)
        ).map((row) => row.action),
    };
  }

  async function uploadedImage() {
    const { db } = setup();
    const mediaKey = `artwork/${integrationSuffix("img")}.jpg`;
    await db.insert(shopMediaAsset).values({
      key: mediaKey,
      kind: "artwork_image",
      status: "active",
      contentType: "image/jpeg",
      byteSize: 1024,
    });
    return mediaKey;
  }

  async function newArtwork(label: string, options: { editions?: boolean } = {}) {
    const { writer, artists } = setup();
    const suffix = integrationSuffix(label);
    const artist = await artists.createArtist({
      displayName: `Artist ${label}`,
      slug: `it-artist-${suffix}`,
      discipline: null,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    const created = await writer.createArtwork({
      slug: `it-artwork-${suffix}`,
      title: `Artwork ${label}`,
      artistId: artist.artistId,
      yearCreated: 2024,
      medium: "Oil on linen",
      dimensions: null,
      description: null,
      eligibleForEditionAllocation: options.editions ?? true,
      printPricePence: null,
      saleState: "for_sale",
      salesChannel: "shop",
      images: [],
      seoTitle: null,
      seoDescription: null,
      canSetPrice: true,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    return { ...created, artistId: artist.artistId };
  }

  async function detailOf(artworkId: string) {
    return requireDefined(await setup().reader.getArtwork(artworkId), "artwork detail");
  }

  function editable(detail: Awaited<ReturnType<typeof detailOf>>) {
    return {
      artworkId: detail.artworkId,
      title: detail.title,
      artistId: detail.artist.artistId,
      yearCreated: detail.yearCreated,
      medium: detail.medium,
      dimensions: detail.dimensions,
      description: detail.description,
      printPricePence: detail.printPricePence,
      saleState: detail.saleState,
      salesChannel: detail.salesChannel,
      images: detail.images.map((image) => ({ mediaKey: image.mediaKey, alt: image.alt })),
      seoTitle: detail.seoTitle,
      seoDescription: detail.seoDescription,
      expectedVersion: detail.version,
      canSetPrice: true,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    };
  }

  it("creates a draft with its edition run, hidden from the storefront", async () => {
    const { storefront, auditActions } = setup();
    const artwork = await newArtwork("draft");
    const detail = await detailOf(artwork.artworkId);
    expect(detail.state).toBe("draft");
    expect(detail.editions.size).toBe(24);
    expect(detail.editions.byAllocation).toEqual({
      original_buyer_entitlement: 10,
      artist: 10,
      lax: 4,
    });
    expect(detail.publishBlockers).toEqual(["no_image", "no_edition_price"]);
    expect(await storefront.getPublicArtworkBySlug(artwork.slug)).toBeNull();
    expect(await auditActions(artwork.artworkId)).toEqual(["create_artwork"]);
  });

  it("publishes once it has an image and a price, then unpublishes and archives", async () => {
    const { writer, storefront, auditActions } = setup();
    const artwork = await newArtwork("publish");
    await expect(
      writer.setVisibility({
        artworkId: artwork.artworkId,
        action: "publish",
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow(ShopDomainError);

    const mediaKey = await uploadedImage();
    await writer.updateArtwork({
      ...editable(await detailOf(artwork.artworkId)),
      printPricePence: 45_000,
      images: [{ mediaKey, alt: "The work" }],
    });
    const published = await writer.setVisibility({
      artworkId: artwork.artworkId,
      action: "publish",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    expect(published.state).toBe("live");
    const onStorefront = requireDefined(
      await storefront.getPublicArtworkBySlug(artwork.slug),
      "public artwork",
    );
    expect(onStorefront.availability).toEqual({ totalEditions: 24, state: "sold_out" });
    expect(onStorefront).not.toHaveProperty("editions");

    await writer.setVisibility({
      artworkId: artwork.artworkId,
      action: "unpublish",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    expect(await storefront.getPublicArtworkBySlug(artwork.slug)).toBeNull();

    const archived = await writer.setVisibility({
      artworkId: artwork.artworkId,
      action: "archive",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    expect(archived.state).toBe("archived");
    expect(await auditActions(artwork.artworkId)).toEqual([
      "create_artwork",
      "update_artwork",
      "publish_artwork",
      "unpublish_artwork",
      "archive_artwork",
    ]);
  });

  it("refuses a price change from staff without price access", async () => {
    const { writer } = setup();
    const artwork = await newArtwork("price");
    const update = writer.updateArtwork({
      ...editable(await detailOf(artwork.artworkId)),
      printPricePence: 30_000,
      canSetPrice: false,
    });
    await expect(update).rejects.toMatchObject({ statusCode: 403 });
    await expect(update).rejects.toBeInstanceOf(ShopApiError);
  });

  it("lets staff without price access save other fields when the price is unchanged", async () => {
    const { writer } = setup();
    const artwork = await newArtwork("no-price-change");
    await writer.updateArtwork({
      ...editable(await detailOf(artwork.artworkId)),
      title: "Renamed by a catalogue editor",
      canSetPrice: false,
    });
    expect((await detailOf(artwork.artworkId)).title).toBe("Renamed by a catalogue editor");
  });

  it("refuses a price on an original", async () => {
    const { writer } = setup();
    const artwork = await newArtwork("original", { editions: false });
    await expect(
      writer.updateArtwork({
        ...editable(await detailOf(artwork.artworkId)),
        printPricePence: 30_000,
      }),
    ).rejects.toThrow("Originals are sold by enquiry");
  });

  it("refuses a stale save with the current version", async () => {
    const { writer } = setup();
    const artwork = await newArtwork("stale");
    const opened = await detailOf(artwork.artworkId);
    await writer.updateArtwork({ ...editable(opened), title: "First" });
    await expect(writer.updateArtwork({ ...editable(opened), title: "Second" })).rejects.toThrow(
      StaleVersionError,
    );
  });

  it("reports each artwork's outcome in a bulk publish", async () => {
    const { writer } = setup();
    const ready = await newArtwork("bulk-ready", { editions: false });
    const mediaKey = await uploadedImage();
    await writer.updateArtwork({
      ...editable(await detailOf(ready.artworkId)),
      images: [{ mediaKey, alt: null }],
    });
    const notReady = await newArtwork("bulk-not-ready");
    const missing = "00000000-0000-4000-8000-00000000dead";
    const { results } = await writer.applyBulkVisibility({
      action: "publish",
      artworkIds: [ready.artworkId, notReady.artworkId, missing],
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    expect(results).toEqual([
      { artworkId: ready.artworkId, outcome: "changed" },
      {
        artworkId: notReady.artworkId,
        outcome: "refused",
        message: "Add an image before publishing",
      },
      { artworkId: missing, outcome: "not_found" },
    ]);
  });

  it("lists by view with counts and searches by artist name", async () => {
    const { reader } = setup();
    const artwork = await newArtwork("listed");
    const page = await reader.listArtworks({ q: "Artist listed", state: "draft" });
    expect(page.items.map((item) => item.artworkId)).toContain(artwork.artworkId);
    expect(page.counts.draft).toBeGreaterThanOrEqual(1);
    const live = await reader.listArtworks({ artistId: artwork.artistId, state: "live" });
    expect(live.items).toEqual([]);
  });

  it("archives an artist only once none of their artworks is live", async () => {
    const { writer, artists } = setup();
    const artwork = await newArtwork("artist-archive", { editions: false });
    const mediaKey = await uploadedImage();
    await writer.updateArtwork({
      ...editable(await detailOf(artwork.artworkId)),
      images: [{ mediaKey, alt: null }],
    });
    await writer.setVisibility({
      artworkId: artwork.artworkId,
      action: "publish",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    await expect(
      artists.setArtistArchived({
        artistId: artwork.artistId,
        archived: true,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("live artwork first");

    await writer.setVisibility({
      artworkId: artwork.artworkId,
      action: "unpublish",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    await expect(
      artists.setArtistArchived({
        artistId: artwork.artistId,
        archived: true,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      }),
    ).resolves.toEqual({ artistId: artwork.artistId, archived: true });
    expect((await detailOf(artwork.artworkId)).publishBlockers).toContain("artist_archived");
  });
});
