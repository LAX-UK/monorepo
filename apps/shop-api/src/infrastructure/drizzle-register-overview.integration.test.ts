import type { NewArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import { createDbFromPool } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  registerRowToEntry,
} from "@auction/persistence/repositories";
import { sql } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OfferOnLaxArtService } from "../application/artwork-register/offer-on-lax-art.service.js";
import { integrationSuffix, uniqueStockCode } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleArtistCatalogueWriter } from "./drizzle-artist-catalogue.writer.js";
import {
  createDrizzleLaxArtArtistDirectory,
  createDrizzleLaxArtDraftWriter,
  createDrizzleLaxArtListingReader,
} from "./drizzle-lax-art-offer.js";
import { createDrizzleRegisterOverviewReader } from "./drizzle-register-overview.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";

const NOW = new Date("2026-11-05T09:00:00.000Z");
const PAGE = { limit: 25, offset: 0 };

describe.skipIf(!hasShopIntegrationDb)("the From Zoho All list (Postgres)", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  // One artist code per test run keeps these records apart from every other test's.
  const code = `Z${integrationSuffix("a").slice(-5).toUpperCase()}`;

  async function record(title: string) {
    const register = new DrizzleArtworkRegisterRepository(createDbFromPool(ownerPool));
    const created = await register.create(
      {
        zohoProductId: `zoho-${integrationSuffix("r")}`,
        stockCode: uniqueStockCode("original"),
        kind: "original",
        sourceOriginalId: null,
        title,
        artist: { zohoArtistId: "77", name: "Ada Rowe", code },
        medium: "Oil on linen",
        dimensions: "90 × 120 cm",
        year: 2024,
        imageRefs: [],
        catalogueStatus: "Available",
      } satisfies NewArtworkRegisterEntry,
      "zoho",
      NOW,
    );
    if (!created.ok) throw new Error(`register entry: ${created.reason}`);
    return created.entry;
  }

  it("reads each record's place, counts the places and filters by place and artist", async () => {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const shopRegister = new DrizzleArtworkRegisterRepository(db);
    const listings = createDrizzleLaxArtListingReader(db);
    const offer = new OfferOnLaxArtService({
      register: shopRegister,
      artists: createDrizzleLaxArtArtistDirectory(db),
      listings,
      drafts: createDrizzleLaxArtDraftWriter(uow, {
        registerFor: (session) => shopRegister.withExecutor(session),
        listings,
      }),
    });
    const artist = await createDrizzleArtistCatalogueWriter(uow).createArtist({
      displayName: `Artist ${code}`,
      slug: `it-overview-${integrationSuffix("s")}`,
      discipline: null,
      actorSubjectId: "overview-it-staff",
      idempotencyKey: `idem-${integrationSuffix("k")}`,
    });

    const plain = await record("Plain");
    const drafted = await record("Drafted");
    const sold = await record("Sold");
    const run = await record("Run");
    await offer.offer({
      registerId: drafted.id,
      body: {
        artistId: artist.artistId,
        saleState: "for_sale",
        slug: `it-overview-${integrationSuffix("d")}`,
      },
      actorSubjectId: "overview-it-staff",
      idempotencyKey: `idem-${integrationSuffix("o")}`,
    });
    await offer.offer({
      registerId: run.id,
      body: {
        artistId: artist.artistId,
        saleState: "for_sale",
        slug: `it-overview-${integrationSuffix("e")}`,
      },
      actorSubjectId: "overview-it-staff",
      idempotencyKey: `idem-${integrationSuffix("p")}`,
    });
    // A listing that is an edition run is never the lax.art listing of an original.
    await createDbFromPool(ownerPool).execute(
      sql`UPDATE shop_artwork SET run_kind = 'open' WHERE zoho_product_id = ${run.zohoProductId}`,
    );
    await createDbFromPool(ownerPool).execute(
      sql`UPDATE artwork_register SET offer_state = 'sold' WHERE id = ${sold.id}`,
    );

    const reader = createDrizzleRegisterOverviewReader(db, registerRowToEntry);
    const all = await reader.listAll({ artistCode: code }, PAGE);
    expect(all.total).toBe(4);
    const draftFlags = Object.fromEntries(
      all.rows.map((row) => [row.entry.title, [row.entry.offer.state, row.hasLaxArtDraft]]),
    );
    expect(draftFlags).toEqual({
      Plain: ["held", false],
      Drafted: ["held", true],
      Sold: ["sold", false],
      Run: ["held", false],
    });

    const idsAt = async (place: Parameters<typeof reader.listAll>[0]["place"]) =>
      (await reader.listAll({ artistCode: code, ...(place ? { place } : {}) }, PAGE)).rows.map(
        (row) => row.entry.id,
      );
    expect((await idsAt("not_offered")).sort()).toEqual([plain.id, run.id].sort());
    expect(await idsAt("draft_lax_art")).toEqual([drafted.id]);
    expect(await idsAt("sold")).toEqual([sold.id]);
    expect(await idsAt("lax_art")).toEqual([]);

    // Counted for this artist alone, so they match what the filtered list shows.
    expect(await reader.countPlaces(code)).toMatchObject({
      not_offered: 2,
      draft_lax_art: 1,
      sold: 1,
      lax_art: 0,
    });

    const artists = await reader.listArtists();
    expect(artists.find((entry) => entry.code === code)).toMatchObject({ count: 4 });
  });
});
