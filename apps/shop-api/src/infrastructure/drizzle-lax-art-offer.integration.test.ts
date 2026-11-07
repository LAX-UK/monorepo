import {
  ArtworkOfferLock,
  type NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import { createDbFromPool } from "@auction/db";
import { shopAdminAudit, shopArtist, shopArtwork, shopArtworkImage } from "@auction/db/schema";
import { DrizzleArtworkRegisterRepository } from "@auction/persistence/repositories";
import { ShopDomainError } from "@auction/shop-domain";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OfferOnLaxArtService } from "../application/artwork-register/offer-on-lax-art.service.js";
import { integrationSuffix, uniqueStockCode } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleAdminArtworkReader } from "./drizzle-admin-artwork.reader.js";
import { createDrizzleArtistCatalogueWriter } from "./drizzle-artist-catalogue.writer.js";
import {
  createDrizzleLaxArtArtistDirectory,
  createDrizzleLaxArtDraftWriter,
  createDrizzleLaxArtListingReader,
} from "./drizzle-lax-art-offer.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { createLinkedListingSyncRunner } from "./scheduler/linked-listing-sync.runner.js";

const ACTOR = "lax-art-offer-it-staff";
const NOW = new Date("2026-11-05T09:00:00.000Z");
const key = () => `idem-${integrationSuffix("o")}`;
const resolveMediaUrl = (value: string | null | undefined) => (value ? `/${value}` : null);

describe.skipIf(!hasShopIntegrationDb)("offer on lax.art (Postgres)", () => {
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
    const register = new DrizzleArtworkRegisterRepository(createDbFromPool(ownerPool));
    const shopRegister = new DrizzleArtworkRegisterRepository(db);
    const listings = createDrizzleLaxArtListingReader(db);
    const service = new OfferOnLaxArtService({
      register: shopRegister,
      artists: createDrizzleLaxArtArtistDirectory(db),
      listings,
      drafts: createDrizzleLaxArtDraftWriter(uow, {
        registerFor: (session) => shopRegister.withExecutor(session),
        listings,
      }),
    });
    return {
      db,
      uow,
      register,
      service,
      artists: createDrizzleArtistCatalogueWriter(uow),
      reader: createDrizzleAdminArtworkReader(db, { resolveMediaUrl }),
    };
  }

  /** A register record, as the Zoho sync would have made it. */
  async function record(patch: Partial<NewArtworkRegisterEntry> = {}) {
    const { register } = setup();
    const suffix = integrationSuffix("r");
    const created = await register.create(
      {
        zohoProductId: `zoho-${suffix}`,
        stockCode: uniqueStockCode("original"),
        kind: "original",
        sourceOriginalId: null,
        title: "Tidal margin IV",
        artist: {
          zohoArtistId: "77",
          name: "Ada Rowe",
          code: `Z${suffix.slice(-5).toUpperCase()}`,
        },
        medium: "Oil on linen",
        dimensions: "90 × 120 cm",
        year: 2024,
        imageRefs: [],
        catalogueStatus: "Available",
        ...patch,
      },
      "zoho",
      NOW,
    );
    if (!created.ok) throw new Error(`register entry: ${created.reason}`);
    return created.entry;
  }

  async function artist(label: string) {
    const { artists } = setup();
    return artists.createArtist({
      displayName: `Artist ${label}`,
      slug: `it-lax-art-offer-${integrationSuffix(label)}`,
      discipline: null,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
  }

  const slugFor = (label: string) => `it-offer-${integrationSuffix(label)}`;

  it("makes a draft from the record, linked to it, and saves Zoho's artist code on the artist", async () => {
    const { service, db, register } = setup();
    const entry = await record();
    const chosen = await artist("claim");
    const slug = slugFor("draft");

    const result = await service.offer({
      registerId: entry.id,
      body: { artistId: chosen.artistId, saleState: "price_on_application", slug },
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });

    expect(result).toMatchObject({ slug, created: true });
    const [row] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, result.artworkId));
    expect(row).toMatchObject({
      title: "Tidal margin IV",
      medium: "Oil on linen",
      dimensions: "90 × 120 cm",
      yearCreated: 2024,
      salesChannel: "art",
      saleState: "price_on_application",
      zohoProductId: entry.zohoProductId,
      publishedAt: null,
      artistId: chosen.artistId,
    });
    const [claimed] = await db
      .select({ code: shopArtist.zohoArtistCode })
      .from(shopArtist)
      .where(eq(shopArtist.id, chosen.artistId));
    expect(claimed?.code).toBe(entry.artist.code);
    const history = await register.listEvents(entry.id, 20);
    expect(history.map((event) => event.type)).toContain("lax_art_draft_created");
    const audit = await db
      .select({ action: shopAdminAudit.action })
      .from(shopAdminAudit)
      .where(eq(shopAdminAudit.targetId, result.artworkId));
    expect(audit.map((entryRow) => entryRow.action)).toContain("offer_on_lax_art");
    // A draft holds nothing: the register still shows the artwork as not offered.
    expect((await register.findById(entry.id))?.offer.state).toBe("held");
  });

  it("gives the same draft for the same request, and for a second request with another key", async () => {
    const { service, db } = setup();
    const entry = await record();
    const chosen = await artist("repeat");
    const body = {
      artistId: chosen.artistId,
      saleState: "for_sale" as const,
      slug: slugFor("same"),
    };
    const sameKey = key();

    const first = await service.offer({
      registerId: entry.id,
      body,
      actorSubjectId: ACTOR,
      idempotencyKey: sameKey,
    });
    const replay = await service.offer({
      registerId: entry.id,
      body,
      actorSubjectId: ACTOR,
      idempotencyKey: sameKey,
    });
    const otherKey = await service.offer({
      registerId: entry.id,
      body: { ...body, slug: slugFor("other") },
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });

    expect(replay.artworkId).toBe(first.artworkId);
    expect(otherKey).toMatchObject({ artworkId: first.artworkId, created: false });
    const rows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.zohoProductId, entry.zohoProductId));
    expect(rows).toHaveLength(1);
  });

  it("makes one draft when two people offer at the same moment", async () => {
    const { service, db } = setup();
    const entry = await record();
    const chosen = await artist("race");
    const attempt = (label: string) =>
      service.offer({
        registerId: entry.id,
        body: { artistId: chosen.artistId, saleState: "for_sale", slug: slugFor(label) },
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });

    const [a, b] = await Promise.all([attempt("a"), attempt("b")]);

    expect(a.artworkId).toBe(b.artworkId);
    const rows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.zohoProductId, entry.zohoProductId));
    expect(rows).toHaveLength(1);
  });

  it("refuses an artwork the register shows somewhere else, in the lock's words", async () => {
    const { service, db, register } = setup();
    const entry = await record();
    const chosen = await artist("held");
    await new ArtworkOfferLock(register, () => NOW).offer(
      { registerId: entry.id },
      { kind: "private_sale", id: "ps-1" },
      "staff:u1",
    );

    await expect(
      service.offer({
        registerId: entry.id,
        body: { artistId: chosen.artistId, saleState: "for_sale", slug: slugFor("held") },
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      }),
    ).rejects.toEqual(
      new ShopDomainError("This artwork is in a private sale. Withdraw it there first."),
    );
    const rows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.zohoProductId, entry.zohoProductId));
    expect(rows).toHaveLength(0);
  });

  it("refuses a print and an artwork Zoho shows as sold", async () => {
    const { service } = setup();
    const chosen = await artist("refuse");
    const sold = await record({ catalogueStatus: "Sold" });
    await expect(
      service.offer({
        registerId: sold.id,
        body: { artistId: chosen.artistId, saleState: "for_sale", slug: slugFor("sold") },
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("Zoho shows this artwork as sold in the gallery");

    const original = await record();
    const print = await record({
      kind: "print",
      stockCode: uniqueStockCode("print"),
      sourceOriginalId: original.id,
    });
    const assessment = await service.assess(print.id);
    expect(assessment.eligible).toBe(false);
    expect(assessment.blockers[0]?.message).toContain("Prints are sold in runs on LAX Shop");
  });

  it("will not move a Zoho artist code from one artist to another", async () => {
    const { service, db } = setup();
    const entry = await record();
    const owner = await artist("owner");
    await db
      .update(shopArtist)
      .set({ zohoArtistCode: entry.artist.code })
      .where(eq(shopArtist.id, owner.artistId));
    const other = await artist("other");

    const assessment = await service.assess(entry.id);
    expect(assessment.matchedArtist?.artistId).toBe(owner.artistId);
    await expect(
      service.offer({
        registerId: entry.id,
        body: { artistId: other.artistId, saleState: "for_sale", slug: slugFor("code") },
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      }),
    ).rejects.toThrow("belongs to another lax.art artist");
  });

  it("shows a taken web address as a conflict on the web address", async () => {
    const { service } = setup();
    const chosen = await artist("slug");
    const slug = slugFor("taken");
    const first = await record();
    await service.offer({
      registerId: first.id,
      body: { artistId: chosen.artistId, saleState: "for_sale", slug },
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    const second = await record();
    const other = await artist("slug-two");

    await expect(
      service.offer({
        registerId: second.id,
        body: { artistId: other.artistId, saleState: "for_sale", slug },
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("slug") });
  });

  it("reads as not ready to publish until Zoho has an image, size and medium", async () => {
    const { service, reader } = setup();
    const entry = await record({ dimensions: null, medium: null, imageRefs: [] });
    const chosen = await artist("blockers");
    const { artworkId } = await service.offer({
      registerId: entry.id,
      body: { artistId: chosen.artistId, saleState: "for_sale", slug: slugFor("blockers") },
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    const detail = await reader.getArtwork(artworkId);
    expect(detail?.publishBlockers).toEqual(["no_zoho_image", "no_size", "no_medium"]);
  });

  it("brings a changed title, size and images from Zoho onto the listing, once", async () => {
    const { service, db, register } = setup();
    const entry = await record();
    const chosen = await artist("sync");
    const { artworkId } = await service.offer({
      registerId: entry.id,
      body: { artistId: chosen.artistId, saleState: "for_sale", slug: slugFor("sync") },
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    await register.applyZohoChange(
      {
        zohoProductId: entry.zohoProductId,
        modifiedAt: new Date(NOW.getTime() + 60_000),
        fields: {
          title: "Tidal margin V",
          dimensions: "100 × 130 cm",
          imageRefs: ["zoho/a.jpg", "zoho/b.jpg"],
        },
      },
      new Date(NOW.getTime() + 60_000),
    );

    const sync = createLinkedListingSyncRunner(db);
    const first = await sync(NOW);
    const [row] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, artworkId));
    expect(row).toMatchObject({ title: "Tidal margin V", dimensions: "100 × 130 cm" });
    const images = await db
      .select({ key: shopArtworkImage.mediaKey })
      .from(shopArtworkImage)
      .where(eq(shopArtworkImage.artworkId, artworkId))
      .orderBy(shopArtworkImage.position);
    expect(images.map((image) => image.key)).toEqual(["zoho/a.jpg", "zoho/b.jpg"]);
    expect(first.details).toBeGreaterThanOrEqual(1);
    expect(first.images).toBeGreaterThanOrEqual(1);
    // Nothing differs now, so a second pass changes nothing for this listing.
    const [after] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, artworkId));
    await sync(NOW);
    const [again] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, artworkId));
    expect(again?.updatedAt.getTime()).toBe(after?.updatedAt.getTime());
  });

  it("follows Zoho's pictures in order, and keeps the alt text written for a picture it still shows", async () => {
    const { service, db, register } = setup();
    const entry = await record();
    const chosen = await artist("pictures");
    const source = (id: string) => ({
      zohoFileId: id,
      fingerprint: "1:1",
      sha256: id.repeat(64).slice(0, 64),
      key: `shop/artwork/zoho-${id}.jpg`,
    });
    await register.replaceZohoImages({
      zohoProductId: entry.zohoProductId,
      sources: [source("a"), source("b")],
      now: NOW,
    });
    const { artworkId } = await service.offer({
      registerId: entry.id,
      body: { artistId: chosen.artistId, saleState: "for_sale", slug: slugFor("pictures") },
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    const keys = () =>
      db
        .select({ key: shopArtworkImage.mediaKey, alt: shopArtworkImage.alt })
        .from(shopArtworkImage)
        .where(eq(shopArtworkImage.artworkId, artworkId))
        .orderBy(shopArtworkImage.position);
    expect((await keys()).map((i) => i.key)).toEqual([
      "shop/artwork/zoho-a.jpg",
      "shop/artwork/zoho-b.jpg",
    ]);
    await db
      .update(shopArtworkImage)
      .set({ alt: "Front, signed" })
      .where(
        and(
          eq(shopArtworkImage.artworkId, artworkId),
          eq(shopArtworkImage.mediaKey, "shop/artwork/zoho-b.jpg"),
        ),
      );

    // Zoho puts b first and adds c.
    await register.replaceZohoImages({
      zohoProductId: entry.zohoProductId,
      sources: [source("b"), source("c"), source("a")],
      now: new Date(NOW.getTime() + 60_000),
    });
    await createLinkedListingSyncRunner(db)(NOW);
    expect(await keys()).toEqual([
      { key: "shop/artwork/zoho-b.jpg", alt: "Front, signed" },
      { key: "shop/artwork/zoho-c.jpg", alt: null },
      { key: "shop/artwork/zoho-a.jpg", alt: null },
    ]);
  });
});
