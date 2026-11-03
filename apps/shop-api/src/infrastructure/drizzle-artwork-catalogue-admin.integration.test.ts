import { emailOutbox, shopAdminAudit, shopMediaAsset } from "@auction/db/schema";
import { ShopDomainError } from "@auction/shop-domain";
import { eq, like } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizeArtworkCatalogueFilters } from "../application/artwork-catalogue-filters.js";
import { createEditionRunServices } from "../application/edition-runs/edition-run-services.js";
import type { OriginalOfferRegister } from "../application/ports/original-offer-register.js";
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
import { createDrizzleReleaseAlertAnnouncer } from "./drizzle-release-alert.announcer.js";
import { createDrizzleReleaseAlertStore } from "./drizzle-release-alert.store.js";
import { createDrizzleShopNotificationPublisher } from "./drizzle-shop-notification.publisher.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createDrizzleEditionRunUnitOfWork } from "./edition-runs/drizzle-edition-run.unit-of-work.js";

const ACTOR = "artwork-catalogue-it-staff";
const key = () => `idem-${integrationSuffix("a")}`;
const resolveMediaUrl = (value: string | null | undefined) => (value ? `/${value}` : null);
const ORIGINS = { shop: "http://localhost:3020", art: "http://localhost:3050" };

/** Facts that let a LAX standard run be published: unsigned, not numbered, no certificate. */
const CONFIRMED_FACTS = {
  spec: { type: "lax_standard" as const },
  facts: {
    numbering: "none" as const,
    signature: { kind: "unsigned" as const },
    certificate: { kind: "none" as const },
  },
  factsConfirmed: true,
};

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

  function setup(offers?: OriginalOfferRegister) {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const notifications = createDrizzleShopNotificationPublisher();
    return {
      db,
      releaseAlertStore: createDrizzleReleaseAlertStore(db, {
        notifications,
        shopOrigin: ORIGINS.shop,
      }),
      writer: createDrizzleArtworkCatalogueWriter(uow, {
        resolveMediaUrl,
        editionRuns: createEditionRunServices({
          uow: createDrizzleEditionRunUnitOfWork(uow),
          clock: { now: () => new Date() },
        }).recorder,
        releaseAlerts: createDrizzleReleaseAlertAnnouncer({
          notifications,
          storefrontOrigins: ORIGINS,
        }),
        ...(offers ? { offers } : {}),
      }),
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
      run: (options.editions ?? true) ? CONFIRMED_FACTS : null,
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
    expect(await auditActions(artwork.artworkId)).toEqual(["record_edition_run", "create_artwork"]);
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
    // A LAX Shop artwork: nothing on lax.art changes, so it is not asked to refresh.
    expect(published.refreshesArt).toBe(false);
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
      "record_edition_run",
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

  it("emails confirmed release alert subscribers once when an edition is published with the alert on", async () => {
    const { writer, releaseAlertStore, db } = setup();
    const suffix = integrationSuffix("release");
    const now = new Date();
    const confirmed = `confirmed-${suffix}@example.com`;
    const waiting = `waiting-${suffix}@example.com`;
    const stopped = `stopped-${suffix}@example.com`;
    const consent = { text: "consent", source: "shop_home" };
    await releaseAlertStore.subscribeAccount({
      email: confirmed,
      identitySubjectId: `subject-${suffix}`,
      consent,
      now,
    });
    await releaseAlertStore.requestConfirmation({ email: waiting, consent, now });
    await releaseAlertStore.subscribeAccount({
      email: stopped,
      identitySubjectId: `subject-stopped-${suffix}`,
      consent,
      now,
    });
    await releaseAlertStore.stopByEmail(stopped, now);

    const publish = async (artworkId: string, sendReleaseAlert: boolean) =>
      writer.setVisibility({
        artworkId,
        action: "publish",
        sendReleaseAlert,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
    const readyArtwork = async (label: string) => {
      const artwork = await newArtwork(label);
      await writer.updateArtwork({
        ...editable(await detailOf(artwork.artworkId)),
        printPricePence: 45_000,
        images: [{ mediaKey: await uploadedImage(), alt: "The work" }],
      });
      return artwork;
    };
    const alertsFor = async (address: string) =>
      db
        .select({ template: emailOutbox.template, vars: emailOutbox.vars })
        .from(emailOutbox)
        .where(like(emailOutbox.toSnapshot, address));

    const quiet = await readyArtwork("release-quiet");
    expect((await publish(quiet.artworkId, false)).releaseAlertsQueued).toBeUndefined();
    expect(
      (await alertsFor(confirmed)).filter((row) => row.template === "shop-release-alert"),
    ).toHaveLength(0);

    const loud = await readyArtwork("release-loud");
    const result = await publish(loud.artworkId, true);
    expect(result.releaseAlertsQueued).toBeGreaterThanOrEqual(1);
    const sent = (await alertsFor(confirmed)).filter(
      (row) => row.template === "shop-release-alert",
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.vars).toMatchObject({
      artworkTitle: "Artwork release-loud",
      artistName: "Artist release-loud",
      artworkUrl: `${ORIGINS.shop}/artworks/${loud.slug}`,
    });
    expect(String(sent[0]?.vars.unsubscribeUrl)).toContain("/release-alerts/unsubscribe?token=");
    expect((await alertsFor(waiting)).map((row) => row.template)).toEqual([
      "shop-release-alert-confirm",
    ]);
    expect(await alertsFor(stopped)).toHaveLength(0);

    // Unpublishing and publishing again never emails the same person about the same edition twice.
    await writer.setVisibility({
      artworkId: loud.artworkId,
      action: "unpublish",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    await publish(loud.artworkId, true);
    expect(
      (await alertsFor(confirmed)).filter((row) => row.template === "shop-release-alert"),
    ).toHaveLength(1);
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

  it("asks the register before publishing an original and tells it when the original leaves", async () => {
    const calls: string[] = [];
    const offers: OriginalOfferRegister = {
      assertCanPublish: async (artwork) => {
        calls.push(`check:${artwork.id}`);
        if (artwork.id === blocked.artworkId) {
          throw new ShopDomainError(
            "This artwork is already offered in a LAX Bid sale. Withdraw it there first.",
          );
        }
      },
      recordPublished: async (artwork) => void calls.push(`published:${artwork.id}`),
      recordWithdrawn: async (artwork) => void calls.push(`withdrawn:${artwork.id}`),
      recordSold: async () => {},
    };
    const { writer } = setup(offers);
    const ready = await newArtwork("offer-ready", { editions: false });
    const blocked = await newArtwork("offer-blocked", { editions: false });
    for (const artwork of [ready, blocked]) {
      await writer.updateArtwork({
        ...editable(await detailOf(artwork.artworkId)),
        images: [{ mediaKey: await uploadedImage(), alt: null }],
      });
    }

    await expect(
      writer.setVisibility({
        artworkId: blocked.artworkId,
        action: "publish",
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("already offered in a LAX Bid sale");
    expect((await detailOf(blocked.artworkId)).state).toBe("draft");

    const { results } = await writer.applyBulkVisibility({
      action: "publish",
      artworkIds: [ready.artworkId, blocked.artworkId],
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    expect(results).toEqual([
      { artworkId: ready.artworkId, outcome: "changed" },
      {
        artworkId: blocked.artworkId,
        outcome: "refused",
        message: "This artwork is already offered in a LAX Bid sale. Withdraw it there first.",
      },
    ]);

    await writer.setVisibility({
      artworkId: ready.artworkId,
      action: "unpublish",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    expect(calls.filter((call) => call.endsWith(ready.artworkId))).toEqual([
      `check:${ready.artworkId}`,
      `published:${ready.artworkId}`,
      `withdrawn:${ready.artworkId}`,
    ]);
    expect(calls).not.toContain(`published:${blocked.artworkId}`);
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
    ).resolves.toEqual({ artistId: artwork.artistId, archived: true, refreshesArt: true });
    expect((await detailOf(artwork.artworkId)).publishBlockers).toContain("artist_archived");
  });

  it("sets the price alone, audits it, and refuses one on an original", async () => {
    const { writer, auditActions } = setup();
    const artwork = await newArtwork("price-only");
    const opened = await detailOf(artwork.artworkId);
    const saved = await writer.setPrice({
      artworkId: artwork.artworkId,
      printPricePence: 52_000,
      expectedVersion: opened.version,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    expect(saved.refreshesArt).toBe(false);
    expect((await detailOf(artwork.artworkId)).printPricePence).toBe(52_000);
    expect(await auditActions(artwork.artworkId)).toEqual([
      "record_edition_run",
      "create_artwork",
      "set_artwork_price",
    ]);

    const original = await newArtwork("price-only-original", { editions: false });
    await expect(
      writer.setPrice({
        artworkId: original.artworkId,
        printPricePence: 52_000,
        expectedVersion: (await detailOf(original.artworkId)).version,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("Originals are sold by enquiry");
  });

  it("links an edition to its original, and each storefront sees the link only while it is live", async () => {
    const { writer, storefront } = setup();
    const edition = await newArtwork("linked-edition");
    const suffix = integrationSuffix("linked-original");
    const original = await writer.createArtwork({
      slug: `it-original-${suffix}`,
      title: "Linked original",
      artistId: edition.artistId,
      yearCreated: 2023,
      medium: "Oil on linen",
      dimensions: null,
      description: null,
      run: null,
      saleState: "price_on_application",
      salesChannel: "art",
      images: [{ mediaKey: await uploadedImage(), alt: null }],
      seoTitle: null,
      seoDescription: null,
      printPricePence: null,
      canSetPrice: true,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });

    // Only an original can be the source, and only an edition can have one.
    await expect(
      writer.updateArtwork({
        ...editable(await detailOf(original.artworkId)),
        sourceOriginalArtworkId: edition.artworkId,
      }),
    ).rejects.toThrow(ShopDomainError);
    await expect(
      writer.updateArtwork({
        ...editable(await detailOf(edition.artworkId)),
        sourceOriginalArtworkId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toThrow(ShopApiError);

    await writer.updateArtwork({
      ...editable(await detailOf(edition.artworkId)),
      printPricePence: 12_000,
      images: [{ mediaKey: await uploadedImage(), alt: null }],
      sourceOriginalArtworkId: original.artworkId,
    });
    expect((await detailOf(edition.artworkId)).sourceOriginal).toEqual({
      artworkId: original.artworkId,
      slug: original.slug,
      title: "Linked original",
    });

    // A save that does not send the field keeps the link.
    await writer.updateArtwork({ ...editable(await detailOf(edition.artworkId)) });
    expect((await detailOf(edition.artworkId)).sourceOriginal?.artworkId).toBe(original.artworkId);

    const published = await writer.setVisibility({
      artworkId: edition.artworkId,
      action: "publish",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    // lax.art lists the edition on the original's page, so it is asked to refresh.
    expect(published.refreshesArt).toBe(true);

    // The original is still a draft: Shop does not link to a page lax.art does not show.
    const beforeOriginalLive = requireDefined(
      await storefront.getPublicArtworkBySlug(edition.slug),
      "edition",
    );
    expect(beforeOriginalLive.sourceOriginalSlug).toBeNull();

    await writer.setVisibility({
      artworkId: original.artworkId,
      action: "publish",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    const linked = requireDefined(await storefront.getPublicArtworkBySlug(edition.slug), "edition");
    expect(linked.sourceOriginalSlug).toBe(original.slug);

    const editionsOfOriginal = await storefront.listPublicArtworks({
      limit: 4,
      filter: normalizeArtworkCatalogueFilters({
        sourceOriginalSlug: original.slug,
        salesChannel: "shop",
        artworkType: "edition",
      }),
    });
    expect(editionsOfOriginal.items.map((item) => item.slug)).toEqual([edition.slug]);

    // Clearing the link removes it from both pages.
    await writer.updateArtwork({
      ...editable(await detailOf(edition.artworkId)),
      sourceOriginalArtworkId: null,
    });
    const unlinked = requireDefined(
      await storefront.getPublicArtworkBySlug(edition.slug),
      "edition",
    );
    expect(unlinked.sourceOriginalSlug).toBeNull();
    const none = await storefront.listPublicArtworks({
      limit: 4,
      filter: normalizeArtworkCatalogueFilters({
        sourceOriginalSlug: original.slug,
        salesChannel: "shop",
        artworkType: "edition",
      }),
    });
    expect(none.items).toEqual([]);
  });
});
