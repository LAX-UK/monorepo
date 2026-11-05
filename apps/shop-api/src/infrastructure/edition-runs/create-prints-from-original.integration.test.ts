import type { Database } from "@auction/db";
import {
  domainEvent,
  shopArtwork,
  shopArtworkImage,
  shopEdition,
  shopMediaAsset,
} from "@auction/db/schema";
import type { AdminNewRunInput } from "@auction/shop-contracts";
import { asc, eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OriginalPrintsRecorder } from "../../application/edition-runs/create-prints-from-original.service.js";
import { createEditionRunServices } from "../../application/edition-runs/edition-run-services.js";
import { integrationSuffix, requireDefined } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleAdminArtworkReader } from "../drizzle-admin-artwork.reader.js";
import { createDrizzleArtistCatalogueWriter } from "../drizzle-artist-catalogue.writer.js";
import { createDrizzleArtworkCatalogueWriter } from "../drizzle-artwork-catalogue.writer.js";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleEditionRunUnitOfWork } from "./drizzle-edition-run.unit-of-work.js";

const ACTOR = "prints-from-original-it-staff";
const key = () => `idem-${integrationSuffix("pfo")}`;
const resolveMediaUrl = (value: string | null | undefined) => (value ? `/${value}` : null);
const STANDARD: AdminNewRunInput = { spec: { type: "lax_standard" } };

describe.skipIf(!hasShopIntegrationDb)("prints from an original", { timeout: 60_000 }, () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  let db: Database;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
    db = createShopDb(shopPool);
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup(wrapRecorder?: (real: OriginalPrintsRecorder) => OriginalPrintsRecorder) {
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const services = createEditionRunServices({
      uow: createDrizzleEditionRunUnitOfWork(uow),
      clock: { now: () => new Date() },
    });
    return {
      services,
      writer: createDrizzleArtworkCatalogueWriter(uow, {
        resolveMediaUrl,
        editionRuns: services.recorder,
        originalPrints: wrapRecorder
          ? wrapRecorder(services.originalPrintsRecorder)
          : services.originalPrintsRecorder,
        releaseAlerts: { recordPublished: async () => ({ queued: 0 }) },
      }),
      artists: createDrizzleArtistCatalogueWriter(uow),
      reader: createDrizzleAdminArtworkReader(db, { resolveMediaUrl }),
    };
  }

  async function artist() {
    return setup().artists.createArtist({
      displayName: `Artist ${integrationSuffix("a")}`,
      slug: `it-pfo-artist-${integrationSuffix("a")}`,
      discipline: null,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
  }

  async function uploadedImage() {
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

  async function originalInput(
    label: string,
    options: { prints?: { title: string; run: AdminNewRunInput } | null } = {},
  ) {
    const { artistId } = await artist();
    const mediaKey = await uploadedImage();
    return {
      slug: `it-pfo-${label}-${integrationSuffix(label)}`,
      title: `Original ${label}`,
      artistId,
      yearCreated: 2024,
      medium: "Oil on linen",
      dimensions: "60 × 80 cm",
      description: null,
      run: null,
      prints: options.prints ?? null,
      printPricePence: null,
      saleState: "price_on_application" as const,
      salesChannel: "art" as const,
      images: [{ mediaKey, alt: "The harbour" }],
      seoTitle: null,
      seoDescription: null,
      canSetPrice: true,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    };
  }

  async function eventTypes(artworkId: string) {
    const rows = await db
      .select({ eventType: domainEvent.eventType })
      .from(domainEvent)
      .where(eq(domainEvent.aggregateId, artworkId));
    return rows.map((row) => row.eventType).sort();
  }

  it("saves an original and its prints together, linked, with stock references and events", async () => {
    const { writer, reader } = setup();
    const input = await originalInput("both", {
      prints: { title: "Original both, prints", run: STANDARD },
    });
    const created = await writer.createArtwork(input);

    const prints = requireDefined(created.prints, "prints");
    expect(prints.editionCount).toBe(24);
    const [original] = await db
      .select()
      .from(shopArtwork)
      .where(eq(shopArtwork.id, created.artworkId));
    const [listing] = await db
      .select()
      .from(shopArtwork)
      .where(eq(shopArtwork.id, prints.artworkId));
    expect(original?.salesChannel).toBe("art");
    expect(original?.eligibleForEditionAllocation).toBe(false);
    expect(listing).toMatchObject({
      salesChannel: "shop",
      eligibleForEditionAllocation: true,
      sourceOriginalArtworkId: created.artworkId,
      artistId: original?.artistId,
      medium: "Oil on linen",
      dimensions: "60 × 80 cm",
      title: "Original both, prints",
      publishedAt: null,
    });
    const images = await db
      .select({ mediaKey: shopArtworkImage.mediaKey })
      .from(shopArtworkImage)
      .where(eq(shopArtworkImage.artworkId, prints.artworkId));
    expect(images).toEqual([{ mediaKey: input.images[0]?.mediaKey }]);

    const editions = await db
      .select({ stockRef: shopEdition.stockRef })
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, prints.artworkId))
      .orderBy(asc(shopEdition.stockRef));
    expect(editions.map((row) => row.stockRef)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );

    expect(await eventTypes(created.artworkId)).toEqual(["shop.artwork.created"]);
    expect(await eventTypes(prints.artworkId)).toEqual([
      "shop.artwork.created",
      "shop.editions.allocated",
    ]);

    const detail = requireDefined(await reader.getArtwork(created.artworkId), "detail");
    expect(detail.linkedPrints).toEqual([
      {
        artworkId: prints.artworkId,
        slug: prints.slug,
        title: "Original both, prints",
        state: "draft",
        size: 24,
      },
    ]);
  });

  it("saves nothing when the prints fail after the original was inserted", async () => {
    const input = await originalInput("fail", {
      prints: { title: "Original fail, prints", run: STANDARD },
    });
    const { writer } = setup((real) => ({
      async recordPrints(effects, request) {
        // The prints and their run are written, then the transaction is forced to fail.
        await real.recordPrints(effects, request);
        throw new Error("forced failure after the prints were written");
      },
    }));

    await expect(writer.createArtwork(input)).rejects.toThrow("forced failure");

    const artworks = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(inArray(shopArtwork.slug, [input.slug, `${input.slug}-prints`]));
    expect(artworks).toEqual([]);
  });

  it("saves nothing when the run is refused", async () => {
    const input = await originalInput("refused", {
      prints: {
        title: "Original refused, prints",
        // 10 + 10 + 3 does not add up to 24.
        run: {
          spec: { type: "custom_limited", size: 24, allocation: { buyer: 10, artist: 10, lax: 3 } },
        },
      },
    });
    const { writer } = setup();
    await expect(writer.createArtwork(input)).rejects.toThrow();
    const rows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.slug, input.slug));
    expect(rows).toEqual([]);
  });

  it("refuses prints on an artwork that is itself an edition", async () => {
    const { writer } = setup();
    const input = await originalInput("edition", {
      prints: { title: "Nested", run: STANDARD },
    });
    await expect(
      writer.createArtwork({
        ...input,
        run: STANDARD,
        salesChannel: "shop",
        saleState: "for_sale",
      }),
    ).rejects.toThrow("together with an original only");
  });

  it("creates prints for an existing original, and a second set beside the first", async () => {
    const { writer, services, reader } = setup();
    const original = await writer.createArtwork(await originalInput("later"));
    const first = await services.printsFromOriginal.create({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      originalArtworkId: original.artworkId,
      title: "Original later, prints",
      run: STANDARD,
    });
    const second = await services.printsFromOriginal.create({
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      originalArtworkId: original.artworkId,
      title: "Original later, second set",
      run: {
        spec: { type: "custom_limited", size: 10, allocation: { buyer: 0, artist: 5, lax: 5 } },
      },
    });
    expect(second.slug).toBe(`${first.slug}-2`);
    const detail = requireDefined(await reader.getArtwork(original.artworkId), "detail");
    expect(detail.linkedPrints?.map((print) => [print.title, print.size])).toEqual([
      ["Original later, prints", 24],
      ["Original later, second set", 10],
    ]);
  });

  it("replays the same request without creating a second set", async () => {
    const { writer, services } = setup();
    const original = await writer.createArtwork(await originalInput("replay"));
    const command = {
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
      originalArtworkId: original.artworkId,
      title: "Original replay, prints",
      run: STANDARD,
    };
    const first = await services.printsFromOriginal.create(command);
    const again = await services.printsFromOriginal.create(command);
    expect(again).toEqual(first);
    const rows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.sourceOriginalArtworkId, original.artworkId));
    expect(rows).toHaveLength(1);
  });

  it("refuses an archived original and creates nothing", async () => {
    const { writer, services } = setup();
    const original = await writer.createArtwork(await originalInput("archived"));
    await writer.setVisibility({
      artworkId: original.artworkId,
      action: "archive",
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    await expect(
      services.printsFromOriginal.create({
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
        originalArtworkId: original.artworkId,
        title: "Too late",
        run: STANDARD,
      }),
    ).rejects.toThrow("archived");
    const rows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.sourceOriginalArtworkId, original.artworkId));
    expect(rows).toEqual([]);
  });
});
