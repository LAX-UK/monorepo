import {
  ArtworkOfferLock,
  type NewArtworkRegisterEntry,
} from "@auction/artwork-register-contracts";
import { createDbFromPool } from "@auction/db";
import { shopAdminAudit, shopArtist, shopArtwork, shopArtworkImage } from "@auction/db/schema";
import {
  DrizzleArtworkRegisterRepository,
  registerRowToEntry,
} from "@auction/persistence/repositories";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZohoLinkRefusedError } from "../application/ports/zoho-link.ports.js";
import { integrationSuffix } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleArtistCatalogueWriter } from "./drizzle-artist-catalogue.writer.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import {
  createDrizzleZohoLinkListingReader,
  createDrizzleZohoLinkRecordReader,
  createDrizzleZohoLinkSettings,
  createDrizzleZohoLinkWriter,
} from "./drizzle-zoho-link.js";

const ACTOR = "zoho-link-it-staff";
const NOW = new Date("2026-11-05T09:00:00.000Z");
const key = () => `idem-${integrationSuffix("l")}`;

describe.skipIf(!hasShopIntegrationDb)("link lax.art originals to Zoho (Postgres)", () => {
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
    const shopRegister = new DrizzleArtworkRegisterRepository(db);
    const register = new DrizzleArtworkRegisterRepository(createDbFromPool(ownerPool));
    const writer = createDrizzleZohoLinkWriter(uow, {
      registerFor: (session) => shopRegister.withExecutor(session),
      lockFor: (session) => new ArtworkOfferLock(shopRegister.withExecutor(session)),
      toEntry: registerRowToEntry,
      now: () => NOW,
    });
    return {
      db,
      register,
      writer,
      listings: createDrizzleZohoLinkListingReader(db),
      records: createDrizzleZohoLinkRecordReader(db, registerRowToEntry),
      settings: createDrizzleZohoLinkSettings(db, () => NOW),
      artists: createDrizzleArtistCatalogueWriter(uow),
    };
  }

  async function record(patch: Partial<NewArtworkRegisterEntry> = {}) {
    const { register } = setup();
    const suffix = integrationSuffix("r");
    // Stock codes are unique across the shared test database: draw another number on a clash.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const number = String(Math.floor(Math.random() * 9000) + 1000);
      const created = await register.create(
        {
          zohoProductId: `zoho-${suffix}`,
          stockCode: `LAX-ORI-AR-TM-26-${number}`,
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
          imageRefs: ["zoho-a.jpg"],
          catalogueStatus: "Available",
          ...patch,
        },
        "zoho",
        NOW,
      );
      if (created.ok) return created.entry;
      if (created.reason !== "duplicate_stock_code") {
        throw new Error(`register entry: ${created.reason}`);
      }
    }
    throw new Error("register entry: no free stock code after 8 attempts");
  }

  /** An original made before the register: on lax.art, with no Zoho Product id. */
  async function legacyListing(
    label: string,
    zohoArtistCode: string,
    options: { published?: boolean } = {},
  ) {
    const { db, artists } = setup();
    const created = await artists.createArtist({
      displayName: `Artist ${label}`,
      slug: `it-zoho-link-${integrationSuffix(label)}`,
      discipline: null,
      actorSubjectId: ACTOR,
      idempotencyKey: key(),
    });
    await db.update(shopArtist).set({ zohoArtistCode }).where(eq(shopArtist.id, created.artistId));
    const [row] = await db
      .insert(shopArtwork)
      .values({
        slug: `it-zoho-link-${integrationSuffix(label)}`,
        title: "Tidal Margin 4",
        artistId: created.artistId,
        eligibleForEditionAllocation: false,
        importKey: `it:zoho-link:${integrationSuffix(label)}`,
        salesChannel: "art",
        saleState: "for_sale",
        medium: "Oil",
        yearCreated: 2023,
        ...(options.published === false ? { publishedAt: null } : {}),
      })
      .returning();
    if (!row) throw new Error("listing");
    await db
      .insert(shopArtworkImage)
      .values({ artworkId: row.id, mediaKey: "legacy.jpg", position: 0, alt: null });
    return row;
  }

  it("lists an original with no Zoho record as not linked, and a linked one no more", async () => {
    const { listings, writer } = setup();
    const entry = await record();
    const listing = await legacyListing("list", entry.artist.code);
    expect((await listings.listUnlinked()).map((l) => l.artworkId)).toContain(listing.id);
    await writer.link({ artworkId: listing.id, registerId: entry.id, actorSubjectId: ACTOR });
    expect((await listings.listUnlinked()).map((l) => l.artworkId)).not.toContain(listing.id);
  });

  it("links a live listing: Zoho's values replace lax.art's, the web address stays, and the register says On lax.art", async () => {
    const { writer, db, register } = setup();
    const entry = await record();
    const listing = await legacyListing("live", entry.artist.code);

    const result = await writer.link({
      artworkId: listing.id,
      registerId: entry.id,
      actorSubjectId: ACTOR,
    });

    expect(result).toMatchObject({ linked: true, nowOnLaxArt: true });
    expect(result.replaced).toEqual(["title", "medium", "size", "year", "images"]);
    const [after] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, listing.id));
    expect(after).toMatchObject({
      slug: listing.slug,
      title: "Tidal margin IV",
      medium: "Oil on linen",
      dimensions: "90 × 120 cm",
      yearCreated: 2024,
      zohoProductId: entry.zohoProductId,
    });
    const images = await db
      .select({ key: shopArtworkImage.mediaKey })
      .from(shopArtworkImage)
      .where(eq(shopArtworkImage.artworkId, listing.id));
    expect(images.map((i) => i.key)).toEqual(["zoho-a.jpg"]);
    const moved = await register.findById(entry.id);
    expect(moved?.offer).toEqual({
      state: "lax_art",
      ref: { kind: "shop_artwork", id: listing.id },
    });
    const history = await register.listEvents(entry.id, 20);
    const linked = history.find((event) => event.type === "zoho_link_linked");
    expect(linked).toMatchObject({ actor: `staff:${ACTOR}` });
    expect(linked?.payload).toMatchObject({ artworkId: listing.id, replaced: result.replaced });
    const audit = await db
      .select({ action: shopAdminAudit.action })
      .from(shopAdminAudit)
      .where(eq(shopAdminAudit.targetId, listing.id));
    expect(audit.map((row) => row.action)).toContain("zoho_link");
  });

  it("is the same result when repeated, and changes nothing the second time", async () => {
    const { writer, register } = setup();
    const entry = await record();
    const listing = await legacyListing("repeat", entry.artist.code);
    const input = { artworkId: listing.id, registerId: entry.id, actorSubjectId: ACTOR };
    await writer.link(input);
    const before = await register.findById(entry.id);
    const again = await writer.link(input);
    expect(again).toMatchObject({ linked: false, replaced: [] });
    expect((await register.findById(entry.id))?.version).toBe(before?.version);
    const linkEvents = (await register.listEvents(entry.id, 20)).filter(
      (event) => event.type === "zoho_link_linked",
    );
    expect(linkEvents).toHaveLength(1);
  });

  it("links a draft without moving the register: publishing records it", async () => {
    const { writer, register } = setup();
    const entry = await record();
    const listing = await legacyListing("draft", entry.artist.code, { published: false });
    const result = await writer.link({
      artworkId: listing.id,
      registerId: entry.id,
      actorSubjectId: ACTOR,
    });
    expect(result).toMatchObject({ linked: true, nowOnLaxArt: false });
    expect((await register.findById(entry.id))?.offer.state).toBe("held");
  });

  it("refuses a record held in a Bid sale with the lock's message, and leaves the listing as it was", async () => {
    const { writer, register, db } = setup();
    const entry = await record();
    const listing = await legacyListing("bid", entry.artist.code);
    await register.moveOffer({
      registerId: entry.id,
      expectedVersion: entry.version,
      to: "bid_sale",
      ref: { kind: "bid_lot", id: `lot-${integrationSuffix("b")}` },
      actor: "staff:setup",
      now: NOW,
    });

    await expect(
      writer.link({ artworkId: listing.id, registerId: entry.id, actorSubjectId: ACTOR }),
    ).rejects.toThrow(ZohoLinkRefusedError);
    await expect(
      writer.link({ artworkId: listing.id, registerId: entry.id, actorSubjectId: ACTOR }),
    ).rejects.toThrow(/LAX Bid sale/);
    const [after] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, listing.id));
    expect(after).toMatchObject({ zohoProductId: null, title: "Tidal Margin 4" });
  });

  it("refuses a record that is sold in the gallery", async () => {
    const { writer } = setup();
    const entry = await record({ catalogueStatus: "Sold" });
    const listing = await legacyListing("sold", entry.artist.code);
    await expect(
      writer.link({ artworkId: listing.id, registerId: entry.id, actorSubjectId: ACTOR }),
    ).rejects.toThrow(ZohoLinkRefusedError);
  });

  it("links one of two listings that want the same record, and refuses the other", async () => {
    const { writer, db } = setup();
    const entry = await record();
    // The second listing's artist is moved to the artist that carries Zoho's code, as a link does.
    const a = await legacyListing("race-a", entry.artist.code);
    const b = await legacyListing("race-b", `Y${integrationSuffix("c").slice(-5).toUpperCase()}`);
    const results = await Promise.allSettled([
      writer.link({ artworkId: a.id, registerId: entry.id, actorSubjectId: ACTOR }),
      writer.link({ artworkId: b.id, registerId: entry.id, actorSubjectId: ACTOR }),
    ]);
    const rows = await db
      .select({ id: shopArtwork.id })
      .from(shopArtwork)
      .where(eq(shopArtwork.zohoProductId, entry.zohoProductId));
    expect(rows).toHaveLength(1);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((result) => result.status === "rejected");
    expect(refused).toMatchObject({ reason: expect.any(ZohoLinkRefusedError) });
  });

  describe("unlinking", () => {
    it("removes the link, releases the register's place, and records who and why", async () => {
      const { writer, db, register } = setup();
      const entry = await record();
      const listing = await legacyListing("unlink", entry.artist.code);
      await writer.link({ artworkId: listing.id, registerId: entry.id, actorSubjectId: ACTOR });

      const unlinked = await writer.unlink({
        artworkId: listing.id,
        reason: "Linked to the wrong record",
        actorSubjectId: ACTOR,
      });

      expect(unlinked).toBe(true);
      const [after] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, listing.id));
      expect(after?.zohoProductId).toBeNull();
      expect((await register.findById(entry.id))?.offer.state).toBe("withdrawn");
      const event = (await register.listEvents(entry.id, 20)).find(
        (e) => e.type === "zoho_link_unlinked",
      );
      expect(event).toMatchObject({ actor: `staff:${ACTOR}` });
      expect(event?.payload).toMatchObject({ reason: "Linked to the wrong record" });
    });

    it("does nothing the second time", async () => {
      const { writer } = setup();
      const entry = await record();
      const listing = await legacyListing("unlink-twice", entry.artist.code);
      await writer.link({ artworkId: listing.id, registerId: entry.id, actorSubjectId: ACTOR });
      const input = { artworkId: listing.id, reason: "Mistake", actorSubjectId: ACTOR };
      expect(await writer.unlink(input)).toBe(true);
      expect(await writer.unlink(input)).toBe(false);
    });

    it("is refused while the artwork is in a Bid sale", async () => {
      const { writer, register, db } = setup();
      const entry = await record();
      const listing = await legacyListing("unlink-bid", entry.artist.code);
      await writer.link({ artworkId: listing.id, registerId: entry.id, actorSubjectId: ACTOR });
      const current = await register.findById(entry.id);
      // The lot takes the artwork's place, as offering at auction does.
      await register.moveOffer({
        registerId: entry.id,
        expectedVersion: current?.version ?? 1,
        to: "withdrawn",
        ref: null,
        actor: "staff:setup",
        now: NOW,
      });
      const withdrawn = await register.findById(entry.id);
      await register.moveOffer({
        registerId: entry.id,
        expectedVersion: withdrawn?.version ?? 1,
        to: "bid_sale",
        ref: { kind: "bid_lot", id: `lot-${integrationSuffix("u")}` },
        actor: "staff:setup",
        now: NOW,
      });
      await expect(
        writer.unlink({ artworkId: listing.id, reason: "Mistake", actorSubjectId: ACTOR }),
      ).rejects.toThrow(/LAX Bid sale/);
      const [after] = await db.select().from(shopArtwork).where(eq(shopArtwork.id, listing.id));
      expect(after?.zohoProductId).toBe(entry.zohoProductId);
    });
  });

  it("keeps the publish switch off until it is turned on, and remembers it", async () => {
    const { settings } = setup();
    const before = await settings.blockUnlinkedPublish();
    await settings.setBlockUnlinkedPublish(true, ACTOR);
    expect(await settings.blockUnlinkedPublish()).toBe(true);
    await settings.setBlockUnlinkedPublish(before, ACTOR);
    expect(await settings.blockUnlinkedPublish()).toBe(before);
  });

  it("searches every original, saying which listing a linked one belongs to", async () => {
    const { records, writer, listings } = setup();
    const entry = await record({ title: `Searchable ${integrationSuffix("s")}` });
    const listing = await legacyListing("search", entry.artist.code);
    const before = (await records.search(entry.title, 10)).find((r) => r.entry.id === entry.id);
    expect(before?.linkedTo).toBeNull();
    await writer.link({ artworkId: listing.id, registerId: entry.id, actorSubjectId: ACTOR });
    const after = (await records.search(entry.title, 10)).find((r) => r.entry.id === entry.id);
    expect(after?.linkedTo).toBe(entry.title);
    expect((await records.findById(entry.id))?.linkedTo).toBe(entry.title);
    const linked = (await listings.listLinked()).find((l) => l.artworkId === listing.id);
    expect(linked).toMatchObject({ registerId: entry.id, actor: `staff:${ACTOR}` });
  });
});
